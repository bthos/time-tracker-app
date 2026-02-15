//! Plugin Discovery - discover plugins from registry and GitHub

use serde::{Deserialize, Serialize};

/// Registry plugin entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegistryPlugin {
    pub id: String,
    pub name: String,
    pub author: String,
    pub repository: String,
    pub latest_version: String,
    pub description: String,
    pub category: Option<String>,
    pub verified: bool,
    pub downloads: u64,
    pub tags: Option<Vec<String>>,
    pub license: Option<String>,
    pub min_core_version: Option<String>,
    pub max_core_version: Option<String>,
    pub api_version: Option<String>,
}

/// Registry response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginRegistry {
    pub version: Option<String>,
    pub last_updated: Option<String>,
    pub plugins: Vec<RegistryPlugin>,
}

/// Plugin manifest from plugin.toml
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    #[serde(rename = "plugin")]
    pub plugin: PluginManifestSection,
    #[serde(rename = "backend")]
    pub backend: Option<BackendSection>,
    #[serde(rename = "frontend")]
    pub frontend: Option<FrontendSection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifestSection {
    pub name: String,
    #[serde(rename = "display_name")]
    pub display_name: Option<String>,
    pub version: String,
    pub author: String,
    pub description: String,
    #[serde(default)]
    pub repository: Option<String>,
    pub license: Option<String>,
    #[serde(rename = "api_version")]
    pub api_version: Option<String>,
    #[serde(rename = "min_core_version")]
    pub min_core_version: Option<String>,
    #[serde(rename = "max_core_version")]
    pub max_core_version: Option<String>,
    #[serde(default)]
    pub dependencies: Option<Vec<PluginDependency>>,
    #[serde(default, rename = "exposed_tables")]
    pub exposed_tables: Option<Vec<ExposedTable>>,
}

/// Plugin dependency declaration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginDependency {
    pub plugin_id: String,
    pub version: Option<String>,  // Optional version constraint (e.g., ">=1.0.0", "1.2.3")
}

/// Exposed table declaration for cross-plugin access
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExposedTable {
    pub table_name: String,
    pub allowed_plugins: Vec<String>,  // Empty = no access, ["*"] = all plugins, ["plugin1", "plugin2"] = specific plugins only
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendSection {
    #[serde(rename = "library_name")]
    pub library_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrontendSection {
    pub entry: Option<String>,
    pub components: Option<Vec<String>>,
}

/// GitHub Release asset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

/// GitHub Release
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub assets: Vec<GitHubReleaseAsset>,
    pub published_at: String,
}

/// Plugin discovery service
pub struct PluginDiscovery {
    registry_url: String,
    cache: Option<PluginRegistry>,
    cache_ttl: std::time::Duration,
    cache_time: Option<std::time::Instant>,
}

impl PluginDiscovery {
    /// Create a new plugin discovery service
    pub fn new(registry_url: String) -> Self {
        Self {
            registry_url,
            cache: None,
            cache_ttl: std::time::Duration::from_secs(3600), // 1 hour cache
            cache_time: None,
        }
    }

    /// Get the plugin registry (with caching)
    pub async fn get_registry(&mut self) -> Result<PluginRegistry, String> {
        // Check cache
        if let Some(cache) = &self.cache {
            if let Some(cache_time) = self.cache_time {
                if cache_time.elapsed() < self.cache_ttl {
                    return Ok(cache.clone());
                }
            }
        }

        // Fetch from URL
        let client = reqwest::Client::new();
        let response = client
            .get(&self.registry_url)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch registry: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Registry returned status: {}", response.status()));
        }

        let registry: PluginRegistry = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse registry: {}", e))?;

        // Update cache
        self.cache = Some(registry.clone());
        self.cache_time = Some(std::time::Instant::now());

        Ok(registry)
    }

    /// Search plugins in registry
    pub async fn search_plugins(&mut self, query: &str) -> Result<Vec<RegistryPlugin>, String> {
        let registry = self.get_registry().await?;
        let query_lower = query.to_lowercase();
        
        let results: Vec<RegistryPlugin> = registry
            .plugins
            .into_iter()
            .filter(|plugin| {
                plugin.name.to_lowercase().contains(&query_lower)
                    || plugin.description.to_lowercase().contains(&query_lower)
                    || plugin.id.to_lowercase().contains(&query_lower)
                    || plugin.tags.as_ref().map_or(false, |tags| {
                        tags.iter().any(|tag| tag.to_lowercase().contains(&query_lower))
                    })
            })
            .collect();

        Ok(results)
    }

    /// Get plugin info from registry by ID
    pub async fn get_plugin_by_id(&mut self, plugin_id: &str) -> Result<Option<RegistryPlugin>, String> {
        let registry = self.get_registry().await?;
        Ok(registry.plugins.into_iter().find(|p| p.id == plugin_id))
    }

    /// Get plugin manifest from GitHub repository
    pub async fn get_plugin_manifest(&self, repository_url: &str) -> Result<PluginManifest, String> {
        // Parse GitHub URL to get owner/repo
        let (owner, repo) = Self::parse_github_url_static(repository_url)?;
        
        // Fetch plugin.toml from repository
        let raw_url = format!(
            "https://raw.githubusercontent.com/{}/{}/main/plugin.toml",
            owner, repo
        );

        let client = reqwest::Client::new();
        let response = client
            .get(&raw_url)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch manifest: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Failed to fetch manifest: status {}", response.status()));
        }

        let content = response
            .text()
            .await
            .map_err(|e| format!("Failed to read manifest: {}", e))?;

        // Parse TOML
        let mut manifest: PluginManifest = toml::from_str(&content)
            .map_err(|e| format!("Failed to parse manifest: {}", e))?;

        // Fill repository field if missing (use the GitHub URL)
        if manifest.plugin.repository.is_none() {
            manifest.plugin.repository = Some(repository_url.to_string());
        }

        Ok(manifest)
    }

    /// Get latest release from GitHub repository
    pub async fn get_latest_release(&self, repository_url: &str) -> Result<GitHubRelease, String> {
        let (owner, repo) = Self::parse_github_url_static(repository_url)?;
        
        let url = format!("https://api.github.com/repos/{}/{}/releases/latest", owner, repo);
        
        let client = reqwest::Client::builder()
            .user_agent("TimeTracker/1.0")
            .build()
            .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to fetch release: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Release API returned status: {}", response.status()));
        }

        let release: GitHubRelease = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse release: {}", e))?;

        Ok(release)
    }

    /// Get release asset URL for current platform
    pub fn get_platform_asset<'a>(&self, release: &'a GitHubRelease) -> Result<&'a GitHubReleaseAsset, String> {
        // Determine platform
        let platform_suffix = if cfg!(target_os = "windows") {
            "windows"
        } else if cfg!(target_os = "macos") {
            "darwin"
        } else if cfg!(target_os = "linux") {
            "linux"
        } else {
            return Err("Unsupported platform".to_string());
        };

        // Find matching asset
        release
            .assets
            .iter()
            .find(|asset| {
                asset.name.contains(platform_suffix)
                    || asset.name.ends_with(".zip")
                    || asset.name.ends_with(".tar.gz")
            })
            .ok_or_else(|| format!("No asset found for platform: {}", platform_suffix))
    }

    /// Parse GitHub URL to owner/repo (static method)
    pub fn parse_github_url_static(url: &str) -> Result<(String, String), String> {
        // Support formats:
        // https://github.com/owner/repo
        // https://github.com/owner/repo.git
        // owner/repo
        
        let url = url.trim_end_matches(".git");
        
        if let Some(stripped) = url.strip_prefix("https://github.com/") {
            let parts: Vec<&str> = stripped.split('/').collect();
            if parts.len() >= 2 {
                return Ok((parts[0].to_string(), parts[1].to_string()));
            }
        }
        
        if let Some(stripped) = url.strip_prefix("http://github.com/") {
            let parts: Vec<&str> = stripped.split('/').collect();
            if parts.len() >= 2 {
                return Ok((parts[0].to_string(), parts[1].to_string()));
            }
        }
        
        // Try owner/repo format
        let parts: Vec<&str> = url.split('/').collect();
        if parts.len() >= 2 {
            return Ok((parts[0].to_string(), parts[1].to_string()));
        }
        
        Err(format!("Invalid GitHub URL: {}", url))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_github_url() {
        let (owner, repo) = PluginDiscovery::parse_github_url_static("https://github.com/user/repo").unwrap();
        assert_eq!(owner, "user");
        assert_eq!(repo, "repo");

        let (owner, repo) = PluginDiscovery::parse_github_url_static("https://github.com/user/repo.git").unwrap();
        assert_eq!(owner, "user");
        assert_eq!(repo, "repo");

        let (owner, repo) = PluginDiscovery::parse_github_url_static("user/repo").unwrap();
        assert_eq!(owner, "user");
        assert_eq!(repo, "repo");
    }
}
