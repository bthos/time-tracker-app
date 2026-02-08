//! Plugin trait and metadata

use serde_json;

/// Plugin metadata
#[derive(Debug, Clone)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
}

/// Plugin trait that all plugins must implement
pub trait Plugin: Send + Sync {
    /// Get plugin metadata
    fn info(&self) -> &PluginInfo;
    
    /// Initialize the plugin
    fn initialize(&mut self, api: &dyn crate::api::PluginAPIInterface) -> Result<(), String>;
    
    /// Invoke a command on the plugin
    /// The api parameter provides database access and other core functionality
    fn invoke_command(&self, command: &str, params: serde_json::Value, api: &dyn crate::api::PluginAPIInterface) -> Result<serde_json::Value, String>;
    
    /// Shutdown the plugin
    fn shutdown(&self) -> Result<(), String>;
    
    /// Get schema extensions that this plugin requires
    /// This allows plugins to declare their own database tables and schema changes
    fn get_schema_extensions(&self) -> Vec<crate::extensions::SchemaExtension> {
        vec![]
    }
    
    /// Get frontend bundle bytes (if plugin provides UI)
    fn get_frontend_bundle(&self) -> Option<Vec<u8>> {
        None
    }
}
