//! Plugin Registry - manages loaded plugins

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use crate::database::Database;

// Re-export SDK types for convenience
pub use time_tracker_plugin_sdk::Plugin as PluginTrait;

/// Registry for managing all loaded plugins
pub struct PluginRegistry {
    plugins: Arc<Mutex<HashMap<String, Box<dyn PluginTrait>>>>,
    db: Arc<Database>,
}

impl PluginRegistry {
    /// Create a new plugin registry
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            plugins: Arc::new(Mutex::new(HashMap::new())),
            db,
        }
    }
    
    /// Register a plugin
    pub fn register(&self, plugin: Box<dyn PluginTrait>) -> Result<(), String> {
        let info = plugin.info();
        let mut plugins = self.plugins.lock().map_err(|e| format!("Failed to lock plugin registry: {}", e))?;
        
        if plugins.contains_key(&info.id) {
            return Err(format!("Plugin {} is already registered", info.id));
        }
        
        plugins.insert(info.id.clone(), plugin);
        Ok(())
    }
    
    /// Get a plugin by ID
    pub fn get(&self, _plugin_id: &str) -> Option<Arc<dyn PluginTrait>> {
        let _plugins = self.plugins.lock().ok()?;
        // Note: We can't return a reference to a trait object from a Mutex
        // This is a limitation - plugins will need to be accessed differently
        // For now, we'll use invoke_command pattern
        None
    }
    
    /// Check if a plugin is installed
    pub fn is_installed(&self, plugin_id: &str) -> Result<bool, String> {
        self.db.is_plugin_installed(plugin_id)
    }
    
    /// Invoke a command on a plugin
    pub fn invoke_plugin_command(
        &self, 
        plugin_id: &str, 
        command: &str, 
        params: serde_json::Value,
        api: &dyn time_tracker_plugin_sdk::PluginAPIInterface,
    ) -> Result<serde_json::Value, String> {
        let plugins = self.plugins.lock().map_err(|e| format!("Failed to lock plugin registry: {}", e))?;
        
        if let Some(plugin) = plugins.get(plugin_id) {
            plugin.invoke_command(command, params, api)
        } else {
            Err(format!("Plugin {} not found", plugin_id))
        }
    }
    
    /// Get all registered plugin IDs
    pub fn get_plugin_ids(&self) -> Vec<String> {
        let plugins = self.plugins.lock().ok();
        plugins.map(|p| p.keys().cloned().collect()).unwrap_or_default()
    }
}
