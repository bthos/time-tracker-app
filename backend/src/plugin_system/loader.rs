//! Plugin Loader - dynamic library loading for plugins

use std::path::{Path, PathBuf};
use std::fs;
use std::io::Write;
use std::sync::{Arc, Mutex};
use libloading::Library;
use crate::plugin_system::discovery::{PluginManifest, GitHubReleaseAsset};

/// Plugin loader for dynamic libraries
pub struct PluginLoader {
    plugins_dir: PathBuf,
    /// Keep loaded libraries alive so plugin symbols remain valid
    loaded_libraries: Arc<Mutex<Vec<Library>>>,
}

impl PluginLoader {
    /// Create a new plugin loader
    pub fn new(plugins_dir: PathBuf) -> Self {
        // Ensure plugins directory exists
        fs::create_dir_all(&plugins_dir).ok();
        
        Self { 
            plugins_dir,
            loaded_libraries: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Get plugins directory path
    pub fn plugins_dir(&self) -> &Path {
        &self.plugins_dir
    }

    /// Get plugin directory path
    pub fn get_plugin_dir(&self, plugin_id: &str) -> PathBuf {
        self.plugins_dir.join(plugin_id)
    }

    /// Download and install plugin from GitHub release
    pub async fn install_from_release(
        &self,
        plugin_id: &str,
        asset: &GitHubReleaseAsset,
    ) -> Result<PathBuf, String> {
        let plugin_dir = self.get_plugin_dir(plugin_id);
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
    pub fn uninstall(&self, plugin_id: &str) -> Result<(), String> {
        let plugin_dir = self.get_plugin_dir(plugin_id);
        if plugin_dir.exists() {
            fs::remove_dir_all(&plugin_dir)
                .map_err(|e| format!("Failed to remove plugin directory: {}", e))?;
        }
        Ok(())
    }

    /// Check if plugin is installed
    pub fn is_installed(&self, plugin_id: &str) -> bool {
        let plugin_dir = self.get_plugin_dir(plugin_id);
        plugin_dir.exists() && plugin_dir.join("plugin.toml").exists()
    }

    /// Get plugin manifest path if installed
    pub fn get_manifest_path(&self, plugin_id: &str) -> Option<PathBuf> {
        let manifest_path = self.get_plugin_dir(plugin_id).join("plugin.toml");
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

    /// Load a plugin dynamically from its installed directory
    /// Returns the loaded plugin instance ready for initialization
    pub fn load_dynamic_plugin(
        &self,
        plugin_id: &str,
    ) -> Result<Box<dyn time_tracker_plugin_sdk::Plugin>, String> {
        use libloading::{Library, Symbol};
        use time_tracker_plugin_sdk::PluginCreateFn;
        
        let plugin_dir = self.get_plugin_dir(plugin_id);
        
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
            if let Ok(mut libs) = self.loaded_libraries.lock() {
                libs.push(lib);
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
        
        for (plugin_id, _name, _version, _description, _repo_url, _manifest_path, _frontend_entry, _frontend_components, enabled) in installed_plugins {
            // Skip disabled plugins
            if !enabled {
                continue;
            }
            
            // Try to load the plugin dynamically
            match self.load_dynamic_plugin(&plugin_id) {
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
        
        Ok(loaded_plugins)
    }
}
