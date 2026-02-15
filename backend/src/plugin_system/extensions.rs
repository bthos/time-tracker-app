//! Extension API - allows plugins to extend Core entities

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use crate::database::{Database, Activity};
use crate::plugin_system::discovery::ExposedTable;

// Re-export SDK types for convenience
pub use time_tracker_plugin_sdk::{EntityType, ExtensionType, SchemaChange, ModelField, AutoTimestamp};

/// Activity hook for data processing (backend-specific)
pub struct ActivityHook {
    pub on_upsert: Box<dyn Fn(&mut Activity, &std::sync::Arc<Database>) -> Result<(), String> + Send + Sync>,
}

/// Query filter (backend-specific wrapper around SDK QueryFilter)
pub struct QueryFilter {
    pub name: String,
    pub filter_fn: Box<dyn Fn(Vec<Activity>, HashMap<String, serde_json::Value>) -> Result<Vec<Activity>, String> + Send + Sync>,
}

/// Extension definition
pub struct Extension {
    pub plugin_id: String,
    pub entity_type: EntityType,
    pub extension_type: ExtensionType,
    pub schema_changes: Vec<SchemaChange>,
    pub model_fields: Vec<ModelField>,
    pub hook: Option<ActivityHook>,
    pub query_filters: Vec<QueryFilter>,
}

/// Registry for managing extensions
pub struct ExtensionRegistry {
    extensions: Arc<Mutex<HashMap<EntityType, Vec<Extension>>>>,
    /// Maps table name -> plugin_id for plugin-created tables (from CreateTable schema changes)
    plugin_tables: Arc<Mutex<HashMap<String, String>>>,
    /// Maps (plugin_id, table_name) -> ExposedTable for cross-plugin table access permissions
    exposed_tables: Arc<Mutex<HashMap<(String, String), ExposedTable>>>,
}

/// Core table names that plugins are not allowed to access via generic CRUD
const CORE_TABLES: &[&str] = &[
    "activities", "categories", "rules", "manual_entries", "settings",
    "installed_plugins", "sqlite_master", "sqlite_sequence",
];

impl ExtensionRegistry {
    /// Create a new extension registry
    pub fn new() -> Self {
        Self {
            extensions: Arc::new(Mutex::new(HashMap::new())),
            plugin_tables: Arc::new(Mutex::new(HashMap::new())),
            exposed_tables: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register an extension
    pub fn register(&self, extension: Extension) -> Result<(), String> {
        // Track plugin-owned tables from CreateTable schema changes
        {
            let mut plugin_tables = self.plugin_tables.lock()
                .map_err(|e| format!("Failed to lock plugin tables: {}", e))?;
            for schema_change in &extension.schema_changes {
                if let SchemaChange::CreateTable { table, .. } = schema_change {
                    plugin_tables.insert(table.clone(), extension.plugin_id.clone());
                }
            }
        }

        let mut extensions = self.extensions.lock()
            .map_err(|e| format!("Failed to lock extension registry: {}", e))?;
        extensions.entry(extension.entity_type)
            .or_insert_with(Vec::new)
            .push(extension);

        Ok(())
    }

    /// Returns true if the given plugin is allowed to access the given table.
    /// Plugins may only access tables they created via CreateTable schema extension.
    pub fn plugin_owns_table(&self, plugin_id: &str, table: &str) -> bool {
        if CORE_TABLES.contains(&table) {
            return false;
        }
        let plugin_tables = match self.plugin_tables.lock() {
            Ok(guard) => guard,
            Err(_) => return false,
        };
        plugin_tables.get(table).map(|id| id.as_str()) == Some(plugin_id)
    }
    
    /// Get plugin ID that owns a table
    pub fn get_table_owner(&self, table: &str) -> Option<String> {
        if CORE_TABLES.contains(&table) {
            return None;
        }
        let plugin_tables = self.plugin_tables.lock().ok()?;
        plugin_tables.get(table).cloned()
    }
    
    /// Register exposed tables from plugin manifest
    pub fn register_exposed_tables(
        &self,
        plugin_id: &str,
        exposed_tables: &[ExposedTable],
    ) -> Result<(), String> {
        let mut exposed = self.exposed_tables.lock()
            .map_err(|e| format!("Failed to lock exposed tables: {}", e))?;
        
        for table in exposed_tables {
            exposed.insert((plugin_id.to_string(), table.table_name.clone()), table.clone());
        }
        
        Ok(())
    }
    
    /// Check if a plugin can query another plugin's table
    pub fn can_query_plugin_table(
        &self,
        requesting_plugin_id: &str,
        target_plugin_id: &str,
        table: &str,
    ) -> bool {
        // 1. Verify target plugin owns the table
        if self.get_table_owner(table) != Some(target_plugin_id.to_string()) {
            return false;
        }
        
        // 2. Check if table is exposed for cross-plugin queries
        let exposed = match self.exposed_tables.lock() {
            Ok(guard) => guard,
            Err(_) => return false,
        };
        
        let exposed_table = match exposed.get(&(target_plugin_id.to_string(), table.to_string())) {
            Some(t) => t,
            None => return false, // Table not exposed
        };
        
        // 3. Permission logic:
        //    - If allowed_plugins contains "*" -> allow all plugins
        //    - If allowed_plugins is empty [] -> deny all plugins
        //    - Otherwise -> check if requesting_plugin_id is in allowed_plugins list
        if exposed_table.allowed_plugins.contains(&"*".to_string()) {
            return true; // Allow all
        }
        
        if exposed_table.allowed_plugins.is_empty() {
            return false; // Deny all
        }
        
        // Check if requesting plugin is in allowed list
        exposed_table.allowed_plugins.contains(&requesting_plugin_id.to_string())
    }
    
    /// Get extensions for an entity type (returns references)
    pub fn get_extensions(&self, _entity_type: EntityType) -> Vec<Extension> {
        // Since Extension contains non-Clone types, we need to return owned values
        // In practice, extensions will be registered once and accessed by reference
        // For now, we'll return empty vec - this will be implemented when we actually use extensions
        vec![]
    }
    
    /// Get schema extensions for an entity type
    pub fn get_schema_extensions(&self, entity_type: EntityType) -> Vec<Extension> {
        let extensions = self.extensions.lock().ok();
        if let Some(ext_map) = extensions {
            if let Some(exts) = ext_map.get(&entity_type) {
                return exts.iter()
                    .filter(|e| matches!(e.extension_type, ExtensionType::DatabaseSchema))
                    .map(|e| Extension {
                        plugin_id: e.plugin_id.clone(),
                        entity_type: e.entity_type,
                        extension_type: e.extension_type.clone(),
                        schema_changes: e.schema_changes.clone(),
                        model_fields: e.model_fields.clone(),
                        hook: None, // Can't clone hooks
                        query_filters: vec![], // Can't clone filters
                    })
                    .collect();
            }
        }
        vec![]
    }
    
    /// Get model extensions for an entity type
    pub fn get_model_extensions(&self, entity_type: EntityType) -> Vec<Extension> {
        let extensions = self.extensions.lock().ok();
        if let Some(ext_map) = extensions {
            if let Some(exts) = ext_map.get(&entity_type) {
                return exts.iter()
                    .filter(|e| matches!(e.extension_type, ExtensionType::Model))
                    .map(|e| Extension {
                        plugin_id: e.plugin_id.clone(),
                        entity_type: e.entity_type,
                        extension_type: e.extension_type.clone(),
                        schema_changes: e.schema_changes.clone(),
                        model_fields: e.model_fields.clone(),
                        hook: None,
                        query_filters: vec![],
                    })
                    .collect();
            }
        }
        vec![]
    }
    
    /// Get data hooks for an entity type
    pub fn get_data_hooks(&self, entity_type: EntityType) -> Vec<Extension> {
        let extensions = self.extensions.lock().ok();
        if let Some(ext_map) = extensions {
            if let Some(exts) = ext_map.get(&entity_type) {
                return exts.iter()
                    .filter(|e| matches!(e.extension_type, ExtensionType::DataHook))
                    .map(|e| Extension {
                        plugin_id: e.plugin_id.clone(),
                        entity_type: e.entity_type,
                        extension_type: e.extension_type.clone(),
                        schema_changes: e.schema_changes.clone(),
                        model_fields: e.model_fields.clone(),
                        hook: None, // Can't clone, but we'll access original
                        query_filters: vec![],
                    })
                    .collect();
            }
        }
        vec![]
    }
    
    /// Get query filters for an entity type
    pub fn get_query_filters(&self, entity_type: EntityType) -> Vec<Extension> {
        let extensions = self.extensions.lock().ok();
        if let Some(ext_map) = extensions {
            if let Some(exts) = ext_map.get(&entity_type) {
                return exts.iter()
                    .filter(|e| matches!(e.extension_type, ExtensionType::Query))
                    .map(|e| Extension {
                        plugin_id: e.plugin_id.clone(),
                        entity_type: e.entity_type,
                        extension_type: e.extension_type.clone(),
                        schema_changes: e.schema_changes.clone(),
                        model_fields: e.model_fields.clone(),
                        hook: None,
                        query_filters: vec![], // Can't clone, but we'll access original
                    })
                    .collect();
            }
        }
        vec![]
    }
    
    /// Get extensions by reference (for accessing hooks and filters)
    pub fn get_extensions_ref(&self, _entity_type: EntityType) -> Vec<&Extension> {
        // This won't work with current Mutex design - we'll need to refactor
        // For now, return empty - will be implemented when needed
        vec![]
    }
    
    /// Apply data hooks for an activity
    /// This method accesses hooks through the Mutex and applies them to the activity
    pub fn apply_activity_hooks(&self, activity: &mut Activity, db: &Arc<Database>) -> Result<(), String> {
        use EntityType::Activity;
        let extensions = self.extensions.lock()
            .map_err(|e| format!("Failed to lock extension registry: {}", e))?;

        if let Some(exts) = extensions.get(&Activity) {
            for ext in exts {
                if matches!(ext.extension_type, ExtensionType::DataHook) {
                    if let Some(ref hook) = ext.hook {
                        (hook.on_upsert)(activity, db)?;
                    }
                }
            }
        }

        Ok(())
    }

    /// Apply plugin query filters for an entity type.
    /// Locks the registry and runs each registered filter in sequence.
    pub fn apply_query_filters(
        &self,
        entity_type: EntityType,
        mut activities: Vec<Activity>,
        filter_params: HashMap<String, serde_json::Value>,
    ) -> Result<Vec<Activity>, String> {
        let extensions = self.extensions.lock()
            .map_err(|e| format!("Failed to lock extension registry: {}", e))?;

        if let Some(exts) = extensions.get(&entity_type) {
            for ext in exts {
                if matches!(ext.extension_type, ExtensionType::Query) {
                    for filter in &ext.query_filters {
                        activities = (filter.filter_fn)(activities, filter_params.clone())?;
                    }
                }
            }
        }

        Ok(activities)
    }
}

impl Default for ExtensionRegistry {
    fn default() -> Self {
        Self::new()
    }
}
