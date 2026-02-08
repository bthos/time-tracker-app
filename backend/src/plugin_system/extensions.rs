//! Extension API - allows plugins to extend Core entities

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use crate::database::{Database, Activity};

// Re-export SDK types for convenience
pub use time_tracker_plugin_sdk::{EntityType, ExtensionType, SchemaChange, ModelField};

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
}

impl ExtensionRegistry {
    /// Create a new extension registry
    pub fn new() -> Self {
        Self {
            extensions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Register an extension
    pub fn register(&self, extension: Extension) -> Result<(), String> {
        let mut extensions = self.extensions.lock()
            .map_err(|e| format!("Failed to lock extension registry: {}", e))?;
        
        extensions.entry(extension.entity_type)
            .or_insert_with(Vec::new)
            .push(extension);
        
        Ok(())
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
}

impl Default for ExtensionRegistry {
    fn default() -> Self {
        Self::new()
    }
}
