//! Plugin Loader - dynamic library loading for plugins

use std::path::{Path, PathBuf};
use std::fs;
use std::io::Write;
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use libloading::Library;
use crate::plugin_system::discovery::{PluginManifest, GitHubReleaseAsset};

/// Plugin loader for dynamic libraries
pub struct PluginLoader {
    plugins_dir: PathBuf,
    /// Keep loaded libraries alive so plugin symbols remain valid
    /// Maps plugin_id to Library handle
    loaded_libraries: Arc<Mutex<HashMap<String, Library>>>,
}

impl PluginLoader {
    /// Create a new plugin loader
    pub fn new(plugins_dir: PathBuf) -> Self {
        // Ensure plugins directory exists
        fs::create_dir_all(&plugins_dir).ok();
        
        Self { 
            plugins_dir,
            loaded_libraries: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Get plugins directory path
    pub fn plugins_dir(&self) -> &Path {
        &self.plugins_dir
    }

    /// Normalize author name for use in file paths
    /// Converts to lowercase, replaces spaces with hyphens, removes special characters
    fn normalize_author_name(author: &str) -> String {
        author.to_lowercase()
            .replace(' ', "-")
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect()
    }

    /// Get plugin directory path with author grouping
    pub fn get_plugin_dir(&self, author: &str, plugin_id: &str) -> PathBuf {
        let normalized_author = Self::normalize_author_name(author);
        self.plugins_dir.join(normalized_author).join(plugin_id)
    }

    /// Download and install plugin from GitHub release
    pub async fn install_from_release(
        &self,
        author: &str,
        plugin_id: &str,
        asset: &GitHubReleaseAsset,
    ) -> Result<PathBuf, String> {
        // Validate author is not empty
        if author.is_empty() {
            return Err("Plugin author is required".to_string());
        }
        
        let plugin_dir = self.get_plugin_dir(author, plugin_id);
        fs::create_dir_all(&plugin_dir)
            .map_err(|e| format!("Failed to create plugin directory: {}", e))?;

        // Download asset
        let client = reqwest::Client::new();
        let response = client
            .get(&asset.browser_download_url)
            .send()
            .await
            .map_err(|e| format!("Failed to download plugin: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Download failed with status: {}", response.status()));
        }

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read download: {}", e))?;

        // Save to temporary file
        let archive_path = plugin_dir.join(&asset.name);
        let mut file = fs::File::create(&archive_path)
            .map_err(|e| format!("Failed to create archive file: {}", e))?;
        file.write_all(&bytes)
            .map_err(|e| format!("Failed to write archive: {}", e))?;

        // Extract archive
        self.extract_archive(&archive_path, &plugin_dir)?;

        // Remove archive file
        fs::remove_file(&archive_path).ok();

        // Find manifest path
        let manifest_path = plugin_dir.join("plugin.toml");
        if !manifest_path.exists() {
            return Err("plugin.toml not found in archive".to_string());
        }

        Ok(manifest_path)
    }

    /// Extract archive (zip or tar.gz)
    fn extract_archive(&self, archive_path: &Path, dest_dir: &Path) -> Result<(), String> {
        let file = fs::File::open(archive_path)
            .map_err(|e| format!("Failed to open archive: {}", e))?;

        if archive_path.extension().and_then(|s| s.to_str()) == Some("zip") {
            // Extract ZIP
            let mut archive = zip::ZipArchive::new(file)
                .map_err(|e| format!("Failed to open ZIP archive: {}", e))?;

            for i in 0..archive.len() {
                let mut file = archive.by_index(i)
                    .map_err(|e| format!("Failed to read ZIP entry {}: {}", i, e))?;
                
                let outpath = match file.enclosed_name() {
                    Some(path) => dest_dir.join(path),
                    None => continue,
                };
                
                if file.name().ends_with('/') {
                    fs::create_dir_all(&outpath)
                        .map_err(|e| format!("Failed to create directory: {}", e))?;
                } else {
                    if let Some(parent) = outpath.parent() {
                        fs::create_dir_all(parent)
                            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                    }
                    
                    let mut outfile = fs::File::create(&outpath)
                        .map_err(|e| format!("Failed to create file: {}", e))?;
                    std::io::copy(&mut file, &mut outfile)
                        .map_err(|e| format!("Failed to extract file: {}", e))?;
                }
            }
        } else if archive_path.extension().and_then(|s| s.to_str()) == Some("gz")
            || archive_path.to_string_lossy().ends_with(".tar.gz")
        {
            // Extract tar.gz
            let tar = flate2::read::GzDecoder::new(file);
            let mut archive = tar::Archive::new(tar);
            archive.unpack(dest_dir)
                .map_err(|e| format!("Failed to extract tar.gz: {}", e))?;
        } else {
            return Err("Unsupported archive format".to_string());
        }

        Ok(())
    }

    /// Load plugin manifest from file
    pub fn load_manifest(&self, manifest_path: &Path) -> Result<PluginManifest, String> {
        let content = fs::read_to_string(manifest_path)
            .map_err(|e| format!("Failed to read manifest: {}", e))?;

        let manifest: PluginManifest = toml::from_str(&content)
            .map_err(|e| format!("Failed to parse manifest: {}", e))?;

        Ok(manifest)
    }

    /// Validate plugin manifest
    pub fn validate_manifest(&self, manifest: &PluginManifest) -> Result<(), String> {
        // Check required fields
        if manifest.plugin.name.is_empty() {
            return Err("Plugin name is required".to_string());
        }
        if manifest.plugin.version.is_empty() {
            return Err("Plugin version is required".to_string());
        }
        if manifest.plugin.author.is_empty() {
            return Err("Plugin author is required".to_string());
        }
        // Repository is optional - can be filled automatically when installing from GitHub

        // Check backend section if present
        if let Some(backend) = &manifest.backend {
            if backend.library_name.is_empty() {
                return Err("Backend library_name is required".to_string());
            }
        }

        Ok(())
    }

    /// Uninstall plugin (remove directory)
    pub fn uninstall(&self, author: &str, plugin_id: &str) -> Result<(), String> {
        let plugin_dir = self.get_plugin_dir(author, plugin_id);
        if plugin_dir.exists() {
            fs::remove_dir_all(&plugin_dir)
                .map_err(|e| format!("Failed to remove plugin directory: {}", e))?;
        }
        Ok(())
    }

    /// Check if plugin is installed
    pub fn is_installed(&self, author: &str, plugin_id: &str) -> bool {
        let plugin_dir = self.get_plugin_dir(author, plugin_id);
        plugin_dir.exists() && plugin_dir.join("plugin.toml").exists()
    }

    /// Get plugin manifest path if installed
    pub fn get_manifest_path(&self, author: &str, plugin_id: &str) -> Option<PathBuf> {
        let manifest_path = self.get_plugin_dir(author, plugin_id).join("plugin.toml");
        if manifest_path.exists() {
            Some(manifest_path)
        } else {
            None
        }
    }

    /// Find library file in plugin directory
    /// 
    /// Search strategy:
    /// 1. Try library_name from manifest (e.g., "pomodoro-plugin-windows-x86_64.dll")
    /// 2. Search for any library file with platform-specific extension (.dll/.dylib/.so)
    /// 3. Fallback to old naming convention ({plugin_id}.dll)
    /// 
    /// For plugin developers:
    /// - Recommended: Set `library_name` in plugin.toml to match your actual library filename
    ///   Example: `library_name = "pomodoro-plugin-windows-x86_64.dll"`
    /// - Alternative: Use any filename with correct extension - system will find it automatically
    fn find_library_file(&self, plugin_dir: &Path, library_name: Option<&str>) -> Result<PathBuf, String> {
        use std::ffi::OsStr;
        
        // Try library_name from manifest first if provided
        if let Some(lib_name) = library_name {
            let lib_path = plugin_dir.join(lib_name);
            if lib_path.exists() {
                return Ok(lib_path);
            }
        }
        
        // Try to find library file by pattern (any file with platform-specific extension)
        let extensions = if cfg!(target_os = "windows") {
            vec!["dll"]
        } else if cfg!(target_os = "macos") {
            vec!["dylib"]
        } else {
            vec!["so"]
        };
        
        // Read directory and find library files
        let entries = fs::read_dir(plugin_dir)
            .map_err(|e| format!("Failed to read plugin directory: {}", e))?;
        
        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let path = entry.path();
            
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(OsStr::to_str) {
                    if extensions.contains(&ext) {
                        // Found a library file - return it
                        return Ok(path);
                    }
                }
            }
        }
        
        Err("No library file found in plugin directory".to_string())
    }

    /// Unload a plugin library by plugin_id
    /// This allows the DLL to be replaced when the plugin is disabled
    pub fn unload_plugin_library(&self, plugin_id: &str) -> Result<(), String> {
        let mut libs = self.loaded_libraries.lock()
            .map_err(|e| format!("Failed to lock loaded libraries: {}", e))?;
        
        if libs.remove(plugin_id).is_some() {
            Ok(())
        } else {
            Err(format!("Plugin {} library not found in loaded libraries", plugin_id))
        }
    }
    
    /// Check if a plugin library is currently loaded
    pub fn is_plugin_loaded(&self, plugin_id: &str) -> bool {
        let libs = self.loaded_libraries.lock().ok();
        libs.map(|l| l.contains_key(plugin_id)).unwrap_or(false)
    }

    /// Load a plugin dynamically from its installed directory
    /// Returns the loaded plugin instance ready for initialization
    pub fn load_dynamic_plugin(
        &self,
        author: &str,
        plugin_id: &str,
    ) -> Result<Box<dyn time_tracker_plugin_sdk::Plugin>, String> {
        use libloading::{Library, Symbol};
        use time_tracker_plugin_sdk::PluginCreateFn;
        
        let plugin_dir = self.get_plugin_dir(author, plugin_id);
        
        // Try to load manifest to get library_name
        let manifest_path = plugin_dir.join("plugin.toml");
        let library_name_opt = if manifest_path.exists() {
            match self.load_manifest(&manifest_path) {
                Ok(manifest) => {
                    manifest.backend.as_ref()
                        .map(|b| b.library_name.clone())
                }
                Err(_) => None,
            }
        } else {
            None
        };
        
        // Find library file (try library_name first, then search by pattern)
        let lib_path = match self.find_library_file(&plugin_dir, library_name_opt.as_deref()) {
            Ok(path) => path,
            Err(_) => {
                // Fallback to old logic if no library found
                let lib_name = if cfg!(target_os = "windows") {
                    format!("{}.dll", plugin_id.replace("-", "_"))
                } else if cfg!(target_os = "macos") {
                    format!("lib{}.dylib", plugin_id.replace("-", "_"))
                } else {
                    format!("lib{}.so", plugin_id.replace("-", "_"))
                };
                let fallback_path = plugin_dir.join(&lib_name);
                if fallback_path.exists() {
                    fallback_path
                } else {
                    return Err(format!("Plugin library not found in: {}", plugin_dir.display()));
                }
            }
        };
        
        // Load the library
        unsafe {
            let lib = Library::new(&lib_path)
                .map_err(|e| format!("Failed to load plugin library {}: {}", lib_path.display(), e))?;
            
            // Resolve the _plugin_create symbol
            let create_fn: Symbol<PluginCreateFn> = lib.get(b"_plugin_create")
                .map_err(|e| format!("Failed to resolve _plugin_create symbol: {}", e))?;
            
            // Call the function to create the plugin instance
            let plugin_ptr = create_fn();
            
            if plugin_ptr.is_null() {
                return Err("Plugin creation function returned null pointer".to_string());
            }
            
            // Store the library handle to keep it loaded
            // This ensures plugin symbols remain valid
            // Map plugin_id to Library for later unloading
            if let Ok(mut libs) = self.loaded_libraries.lock() {
                libs.insert(plugin_id.to_string(), lib);
            } else {
                // If we can't store it, leak it to prevent crashes
                std::mem::forget(lib);
            }
            
            // Convert raw pointer to Box<dyn Plugin>
            // Note: Box::from_raw is safe here because we're already in an unsafe block
            let plugin = Box::from_raw(plugin_ptr);
            
            Ok(plugin)
        }
    }
    
    /// Validate plugin dependencies are satisfied
    pub fn validate_dependencies(
        &self,
        plugin_id: &str,
        manifest: &PluginManifest,
        installed_plugins: &[String],
    ) -> Result<(), String> {
        if let Some(ref dependencies) = manifest.plugin.dependencies {
            for dep in dependencies {
                if !installed_plugins.contains(&dep.plugin_id) {
                    return Err(format!(
                        "Plugin {} requires dependency {} which is not installed",
                        plugin_id, dep.plugin_id
                    ));
                }
                // TODO: Add version constraint checking if needed
                // For now, we just check if the plugin is installed
            }
        }
        Ok(())
    }
    
    /// Resolve plugin loading order based on dependencies (topological sort)
    pub fn resolve_load_order(
        &self,
        plugins: &[(String, PluginManifest)],
    ) -> Result<Vec<String>, String> {
        use std::collections::{HashMap, HashSet, VecDeque};
        
        let mut in_degree: HashMap<String, usize> = HashMap::new();
        let mut graph: HashMap<String, Vec<String>> = HashMap::new();
        let mut all_plugins: HashSet<String> = HashSet::new();
        
        // Initialize graph and collect all plugin IDs
        for (plugin_id, manifest) in plugins {
            all_plugins.insert(plugin_id.clone());
            in_degree.insert(plugin_id.clone(), 0);
            graph.insert(plugin_id.clone(), Vec::new());
            
            if let Some(ref dependencies) = manifest.plugin.dependencies {
                for dep in dependencies {
                    graph.entry(dep.plugin_id.clone())
                        .or_insert_with(Vec::new)
                        .push(plugin_id.clone());
                    *in_degree.entry(plugin_id.clone()).or_insert(0) += 1;
                }
            }
        }
        
        // Check for circular dependencies
        let mut visited = HashSet::new();
        let mut rec_stack = HashSet::new();
        
        fn has_cycle(
            plugin_id: &str,
            graph: &HashMap<String, Vec<String>>,
            visited: &mut HashSet<String>,
            rec_stack: &mut HashSet<String>,
        ) -> bool {
            visited.insert(plugin_id.to_string());
            rec_stack.insert(plugin_id.to_string());
            
            if let Some(deps) = graph.get(plugin_id) {
                for dep in deps {
                    if !visited.contains(dep) {
                        if has_cycle(dep, graph, visited, rec_stack) {
                            return true;
                        }
                    } else if rec_stack.contains(dep) {
                        return true;
                    }
                }
            }
            
            rec_stack.remove(plugin_id);
            false
        }
        
        for plugin_id in all_plugins.iter() {
            if !visited.contains(plugin_id) {
                if has_cycle(plugin_id, &graph, &mut visited, &mut rec_stack) {
                    return Err("Circular dependency detected in plugin dependencies".to_string());
                }
            }
        }
        
        // Topological sort using Kahn's algorithm
        let mut queue = VecDeque::new();
        let mut result = Vec::new();
        
        // Find all plugins with no incoming edges
        for (plugin_id, degree) in &in_degree {
            if *degree == 0 {
                queue.push_back(plugin_id.clone());
            }
        }
        
        while let Some(plugin_id) = queue.pop_front() {
            result.push(plugin_id.clone());
            
            if let Some(deps) = graph.get(&plugin_id) {
                for dep in deps {
                    if let Some(degree) = in_degree.get_mut(dep) {
                        *degree -= 1;
                        if *degree == 0 {
                            queue.push_back(dep.clone());
                        }
                    }
                }
            }
        }
        
        // Check if all plugins were processed (should be if no cycles)
        if result.len() != all_plugins.len() {
            return Err("Failed to resolve dependency order - some plugins have unsatisfied dependencies".to_string());
        }
        
        Ok(result)
    }
    
    /// Load all installed plugins from the plugins directory
    /// Returns a vector of (plugin_id, plugin_instance) tuples
    pub fn load_all_installed_plugins(
        &self,
        db: &crate::database::Database,
    ) -> Result<Vec<(String, Box<dyn time_tracker_plugin_sdk::Plugin>)>, String> {
        let mut loaded_plugins = Vec::new();
        
        // Get list of installed plugins from database
        let installed_plugins = db.get_installed_plugins()
            .map_err(|e| format!("Failed to get installed plugins: {}", e))?;
        
        // Collect plugin IDs and manifests for dependency resolution
        let mut plugin_manifests: Vec<(String, PluginManifest)> = Vec::new();
        let mut plugin_info: HashMap<String, (String, Option<String>)> = HashMap::new(); // plugin_id -> (author, manifest_path)
        
        for (plugin_id, _name, _version, _description, _repo_url, _manifest_path, _frontend_entry, _frontend_components, author, enabled) in installed_plugins {
            // Skip disabled plugins
            if !enabled {
                continue;
            }
            
            // Clone manifest_path early to avoid move issues
            let manifest_path_clone = _manifest_path.clone();
            
            // Get author from database or try to read from manifest
            let author = if let Some(auth) = author {
                auth
            } else {
                // Try to read author from manifest if not in database
                if let Some(ref manifest_path_str) = manifest_path_clone {
                    let manifest_path = std::path::PathBuf::from(manifest_path_str);
                    if let Ok(manifest) = self.load_manifest(&manifest_path) {
                        manifest.plugin.author
                    } else {
                        eprintln!("Warning: Failed to load manifest for plugin {} to get author", plugin_id);
                        continue;
                    }
                } else {
                    eprintln!("Warning: Plugin {} has no author and no manifest path", plugin_id);
                    continue;
                }
            };
            
            // Load manifest for dependency resolution
            if let Some(ref manifest_path_str) = manifest_path_clone {
                let manifest_path = std::path::PathBuf::from(manifest_path_str);
                if let Ok(manifest) = self.load_manifest(&manifest_path) {
                    plugin_manifests.push((plugin_id.clone(), manifest));
                    plugin_info.insert(plugin_id.clone(), (author.clone(), manifest_path_clone));
                } else {
                    eprintln!("Warning: Failed to load manifest for plugin {}", plugin_id);
                    plugin_info.insert(plugin_id.clone(), (author.clone(), None));
                }
            } else {
                plugin_info.insert(plugin_id.clone(), (author.clone(), None));
            }
        }
        
        // Resolve load order based on dependencies
        let load_order = self.resolve_load_order(&plugin_manifests)?;
        
        // Validate dependencies for each plugin
        let installed_plugin_ids: Vec<String> = plugin_info.keys().cloned().collect();
        for (plugin_id, manifest) in &plugin_manifests {
            if let Err(e) = self.validate_dependencies(plugin_id, manifest, &installed_plugin_ids) {
                eprintln!("Warning: {}", e);
                // Continue loading other plugins even if dependencies are missing
            }
        }
        
        // Load plugins in dependency order
        for plugin_id in load_order {
            if let Some((author, _manifest_path)) = plugin_info.get(&plugin_id) {
                // Try to load the plugin dynamically
                match self.load_dynamic_plugin(author, &plugin_id) {
                    Ok(plugin) => {
                        loaded_plugins.push((plugin_id.clone(), plugin));
                        eprintln!("Loaded dynamic plugin: {}", plugin_id);
                    }
                    Err(e) => {
                        eprintln!("Warning: Failed to load plugin {}: {}", plugin_id, e);
                        // Continue loading other plugins even if one fails
                    }
                }
            }
        }
        
        Ok(loaded_plugins)
    }
}
