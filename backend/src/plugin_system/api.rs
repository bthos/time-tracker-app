//! Plugin API - interface for plugins to interact with Core

use crate::database::Database;
use crate::plugin_system::extensions::{ExtensionRegistry, Extension, ActivityHook, QueryFilter};
use std::sync::Arc;
use time_tracker_plugin_sdk::{
    PluginAPIInterface, 
    EntityType, ExtensionType, SchemaChange, ModelField,
    EntityType as SDKEntityType, 
    SchemaChange as SDKSchemaChange, 
    ModelField as SDKModelField, 
    QueryFilter as SDKQueryFilter,
    ActivityFilters
};

/// Plugin API provides plugins with access to Core functionality
pub struct PluginAPI {
    db: Arc<Database>,
    extension_registry: Arc<ExtensionRegistry>,
    plugin_id: String,
}

impl PluginAPI {
    /// Create a new Plugin API instance
    pub fn new(db: Arc<Database>, extension_registry: Arc<ExtensionRegistry>, plugin_id: String) -> Self {
        Self {
            db,
            extension_registry,
            plugin_id,
        }
    }
    
    /// Get database access
    pub fn database(&self) -> &Arc<Database> {
        &self.db
    }
    
    /// Register an extension
    pub fn register_extension(&self, mut extension: Extension) -> Result<(), String> {
        extension.plugin_id = self.plugin_id.clone();
        self.extension_registry.register(extension)
    }
    
    /// Register a database schema extension
    pub fn register_schema_extension(
        &self,
        entity_type: EntityType,
        schema_changes: Vec<SchemaChange>,
    ) -> Result<(), String> {
        self.register_extension(Extension {
            plugin_id: self.plugin_id.clone(),
            entity_type,
            extension_type: ExtensionType::DatabaseSchema,
            schema_changes,
            model_fields: vec![],
            hook: None,
            query_filters: vec![],
        })
    }
    
    /// Register a model extension
    pub fn register_model_extension(
        &self,
        entity_type: EntityType,
        model_fields: Vec<ModelField>,
    ) -> Result<(), String> {
        self.register_extension(Extension {
            plugin_id: self.plugin_id.clone(),
            entity_type,
            extension_type: ExtensionType::Model,
            schema_changes: vec![],
            model_fields,
            hook: None,
            query_filters: vec![],
        })
    }
    
    /// Register a data hook
    pub fn register_data_hook(
        &self,
        entity_type: EntityType,
        hook: ActivityHook,
    ) -> Result<(), String> {
        self.register_extension(Extension {
            plugin_id: self.plugin_id.clone(),
            entity_type,
            extension_type: ExtensionType::DataHook,
            schema_changes: vec![],
            model_fields: vec![],
            hook: Some(hook),
            query_filters: vec![],
        })
    }
    
    /// Register query filters
    pub fn register_query_filters(
        &self,
        entity_type: EntityType,
        query_filters: Vec<QueryFilter>,
    ) -> Result<(), String> {
        self.register_extension(Extension {
            plugin_id: self.plugin_id.clone(),
            entity_type,
            extension_type: ExtensionType::Query,
            schema_changes: vec![],
            model_fields: vec![],
            hook: None,
            query_filters,
        })
    }
}

impl PluginAPIInterface for PluginAPI {
    fn register_schema_extension(
        &self,
        entity_type: SDKEntityType,
        schema_changes: Vec<SDKSchemaChange>,
    ) -> Result<(), String> {
        // Convert SDK types to backend types
        let entity_type_backend = match entity_type {
            SDKEntityType::Activity => EntityType::Activity,
            SDKEntityType::ManualEntry => EntityType::ManualEntry,
            SDKEntityType::Category => EntityType::Category,
        };
        
        let schema_changes_backend: Vec<SchemaChange> = schema_changes.into_iter().map(|sc| {
            match sc {
                SDKSchemaChange::CreateTable { table, columns } => {
                    SchemaChange::CreateTable { table, columns }
                }
                SDKSchemaChange::AddColumn { table, column, column_type, default, foreign_key } => {
                    SchemaChange::AddColumn { table, column, column_type, default, foreign_key }
                }
                SDKSchemaChange::AddIndex { table, index, columns } => {
                    SchemaChange::AddIndex { table, index, columns }
                }
                SDKSchemaChange::AddForeignKey { table, column, foreign_table, foreign_column } => {
                    SchemaChange::AddForeignKey { table, column, foreign_table, foreign_column }
                }
            }
        }).collect();
        
        self.register_extension(Extension {
            plugin_id: self.plugin_id.clone(),
            entity_type: entity_type_backend,
            extension_type: ExtensionType::DatabaseSchema,
            schema_changes: schema_changes_backend,
            model_fields: vec![],
            hook: None,
            query_filters: vec![],
        })
    }
    
    fn register_model_extension(
        &self,
        entity_type: SDKEntityType,
        model_fields: Vec<SDKModelField>,
    ) -> Result<(), String> {
        let entity_type_backend = match entity_type {
            SDKEntityType::Activity => EntityType::Activity,
            SDKEntityType::ManualEntry => EntityType::ManualEntry,
            SDKEntityType::Category => EntityType::Category,
        };
        
        let model_fields_backend: Vec<ModelField> = model_fields.into_iter().map(|mf| {
            ModelField {
                name: mf.name,
                type_: mf.type_,
                optional: mf.optional,
            }
        }).collect();
        
        self.register_extension(Extension {
            plugin_id: self.plugin_id.clone(),
            entity_type: entity_type_backend,
            extension_type: ExtensionType::Model,
            schema_changes: vec![],
            model_fields: model_fields_backend,
            hook: None,
            query_filters: vec![],
        })
    }
    
    fn register_query_filters(
        &self,
        _entity_type: SDKEntityType,
        _query_filters: Vec<SDKQueryFilter>,
    ) -> Result<(), String> {
        // SDK QueryFilter uses serde_json::Value, backend QueryFilter uses Activity
        // This conversion will need to be handled differently - for now, return error
        // TODO: Refactor QueryFilter to work with SDK types
        Err("Query filters conversion not yet implemented".to_string())
    }
    
    fn call_db_method(&self, method: &str, params: serde_json::Value) -> Result<serde_json::Value, String> {
        // Route database method calls to the appropriate handler
        let params_map = params.as_object().ok_or("Params must be an object")?;
        
        match method {
            // Category methods (return JSON with all columns including plugin-extended fields)
            "create_category" => {
                let name = params_map["name"].as_str().ok_or("Missing name")?.to_string();
                let color = params_map["color"].as_str().unwrap_or("#888888").to_string();
                let icon = params_map["icon"].as_str().map(|s| s.to_string());
                let is_productive = params_map["is_productive"].as_bool();
                let sort_order = params_map["sort_order"].as_i64().unwrap_or(0);
                let is_system = params_map["is_system"].as_bool().unwrap_or(false);
                let is_pinned = params_map["is_pinned"].as_bool().unwrap_or(false);

                let id = self.db.create_category_core(
                    &name,
                    &color,
                    icon.as_deref(),
                    is_productive,
                    sort_order,
                    is_system,
                    is_pinned,
                ).map_err(|e| e.to_string())?;

                // Write plugin-extended fields (any param key not in core set)
                let core_keys = ["id", "name", "color", "icon", "is_productive", "sort_order", "is_system", "is_pinned"];
                let extended: serde_json::Map<String, serde_json::Value> = params_map
                    .iter()
                    .filter(|(k, _)| !core_keys.contains(&k.as_str()))
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect();
                if !extended.is_empty() {
                    self.db.update_categories_extended(id, &extended).map_err(|e| e.to_string())?;
                }

                let categories = self.db.get_categories_as_json().map_err(|e| e.to_string())?;
                let category = categories
                    .into_iter()
                    .find(|c| c.get("id").and_then(|v| v.as_i64()) == Some(id))
                    .ok_or_else(|| "Failed to retrieve created category".to_string())?;
                Ok(category)
            }
            "update_category" => {
                let id = params_map["id"].as_i64().ok_or("Missing id")?;
                let name = params_map["name"].as_str().ok_or("Missing name")?.to_string();
                let color = params_map["color"].as_str().unwrap_or("#888888").to_string();
                let icon = params_map["icon"].as_str().map(|s| s.to_string());
                let is_productive = params_map["is_productive"].as_bool();
                let sort_order = params_map["sort_order"].as_i64().unwrap_or(0);
                let is_pinned = params_map["is_pinned"].as_bool();

                let current = self.db.get_categories().map_err(|e| e.to_string())?
                    .into_iter()
                    .find(|c| c.id == id)
                    .ok_or_else(|| "Category not found".to_string())?;

                let is_pinned_bool = is_pinned.unwrap_or(current.is_pinned);

                self.db.update_category_core(
                    id,
                    &name,
                    &color,
                    icon.as_deref(),
                    is_productive.or(current.is_productive),
                    sort_order,
                    is_pinned_bool,
                ).map_err(|e| e.to_string())?;

                // Write plugin-extended fields
                let core_keys = ["id", "name", "color", "icon", "is_productive", "sort_order", "is_system", "is_pinned"];
                let extended: serde_json::Map<String, serde_json::Value> = params_map
                    .iter()
                    .filter(|(k, _)| !core_keys.contains(&k.as_str()))
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect();
                if !extended.is_empty() {
                    self.db.update_categories_extended(id, &extended).map_err(|e| e.to_string())?;
                }

                let categories = self.db.get_categories_as_json().map_err(|e| e.to_string())?;
                let category = categories
                    .into_iter()
                    .find(|c| c.get("id").and_then(|v| v.as_i64()) == Some(id))
                    .ok_or_else(|| "Category not found".to_string())?;
                Ok(category)
            }
            "get_categories" => {
                let categories = self.db.get_categories_as_json().map_err(|e| e.to_string())?;
                Ok(serde_json::Value::Array(categories))
            }
            "delete_category" => {
                let id = params_map["id"].as_i64().ok_or("Missing id")?;
                self.db.delete_category(id).map_err(|e| e.to_string())?;
                Ok(serde_json::json!({}))
            }
            // Activities (for plugins that need to analyze tracked time)
            "get_activities" => {
                let start = params_map["start"].as_i64().ok_or("Missing start")?;
                let end = params_map["end"].as_i64().ok_or("Missing end")?;
                let limit = params_map.get("limit").and_then(|v| v.as_i64());
                let offset = params_map.get("offset").and_then(|v| v.as_i64());
                let exclude_idle = params_map.get("exclude_idle").and_then(|v| v.as_bool());
                let category_ids = params_map.get("category_ids")
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().filter_map(|v| v.as_i64()).collect::<Vec<i64>>());
                let activities = self
                    .db
                    .get_activities(start, end, limit, offset, exclude_idle, category_ids.as_deref())
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(activities).map_err(|e| e.to_string())?)
            }
            // Manual entry methods
            "create_manual_entry" => {
                let description = params_map["description"].as_str().map(|s| s.to_string());
                let category_id = params_map["category_id"].as_i64();
                let started_at = params_map["started_at"].as_i64().ok_or("Missing started_at")?;
                let ended_at = params_map["ended_at"].as_i64().ok_or("Missing ended_at")?;

                let id = self.db.add_manual_entry(
                    description.as_deref(),
                    category_id,
                    started_at,
                    ended_at,
                ).map_err(|e| e.to_string())?;

                let entries = self.db.get_manual_entries(started_at.saturating_sub(1), ended_at.saturating_add(1))
                    .map_err(|e| e.to_string())?;
                let entry = entries.into_iter()
                    .find(|e| e.id == id)
                    .ok_or_else(|| "Failed to retrieve created entry".to_string())?;
                Ok(serde_json::to_value(entry).map_err(|e| e.to_string())?)
            }
            "update_manual_entry" => {
                let id = params_map["id"].as_i64().ok_or("Missing id")?;
                let description = params_map["description"].as_str().map(|s| s.to_string());
                let category_id = params_map["category_id"].as_i64();
                let started_at = params_map["started_at"].as_i64().ok_or("Missing started_at")?;
                let ended_at = params_map["ended_at"].as_i64().ok_or("Missing ended_at")?;

                let current = self.db.get_manual_entries(0, i64::MAX).map_err(|e| e.to_string())?
                    .into_iter()
                    .find(|e| e.id == id)
                    .ok_or_else(|| "Manual entry not found".to_string())?;

                let category_id = category_id.or(current.category_id);
                let description_ref = description
                    .as_deref()
                    .or(current.description.as_deref());
                self.db.update_manual_entry(
                    id,
                    description_ref,
                    category_id,
                    started_at,
                    ended_at,
                ).map_err(|e| e.to_string())?;

                let entries = self.db.get_manual_entries(0, i64::MAX).map_err(|e| e.to_string())?;
                let entry = entries.into_iter()
                    .find(|e| e.id == id)
                    .ok_or_else(|| "Manual entry not found".to_string())?;
                Ok(serde_json::to_value(entry).map_err(|e| e.to_string())?)
            }
            "get_manual_entries" => {
                let start = params_map["start"].as_i64().ok_or("Missing start")?;
                let end = params_map["end"].as_i64().ok_or("Missing end")?;
                let entries = self.db.get_manual_entries(start, end).map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(entries).map_err(|e| e.to_string())?)
            }
            "delete_manual_entry" => {
                let id = params_map["id"].as_i64().ok_or("Missing id")?;
                self.db.delete_manual_entry(id).map_err(|e| e.to_string())?;
                Ok(serde_json::json!({}))
            }
            // Generic plugin table CRUD (only for tables owned by this plugin)
            "insert_table" => {
                let table = params_map["table"].as_str().ok_or("Missing table")?;
                if !self.extension_registry.plugin_owns_table(&self.plugin_id, table) {
                    return Err(format!("Plugin does not own table: {}", table));
                }
                let data = params_map["data"]
                    .as_object()
                    .ok_or("Missing or invalid data object")?;
                let id = self.db.plugin_insert_table(table, data).map_err(|e| e.to_string())?;
                Ok(serde_json::json!({ "id": id }))
            }
            "select_table" => {
                let table = params_map["table"].as_str().ok_or("Missing table")?;
                if !self.extension_registry.plugin_owns_table(&self.plugin_id, table) {
                    return Err(format!("Plugin does not own table: {}", table));
                }
                let filters = params_map.get("filters").and_then(|v| v.as_object());
                let order_by = params_map.get("order_by").and_then(|v| v.as_str());
                let limit = params_map.get("limit").and_then(|v| v.as_i64());
                let rows = self
                    .db
                    .plugin_select_table(table, filters, order_by, limit)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::Value::Array(rows))
            }
            "update_table" => {
                let table = params_map["table"].as_str().ok_or("Missing table")?;
                if !self.extension_registry.plugin_owns_table(&self.plugin_id, table) {
                    return Err(format!("Plugin does not own table: {}", table));
                }
                let id = params_map["id"].as_i64().ok_or("Missing id")?;
                let data = params_map["data"]
                    .as_object()
                    .ok_or("Missing or invalid data object")?;
                let n = self
                    .db
                    .plugin_update_table(table, id, data)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::json!({ "updated": n }))
            }
            "delete_table" => {
                let table = params_map["table"].as_str().ok_or("Missing table")?;
                if !self.extension_registry.plugin_owns_table(&self.plugin_id, table) {
                    return Err(format!("Plugin does not own table: {}", table));
                }
                let id = params_map["id"].as_i64().ok_or("Missing id")?;
                let n = self
                    .db
                    .plugin_delete_table(table, id)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::json!({ "deleted": n }))
            }
            "aggregate_table" => {
                let table = params_map["table"].as_str().ok_or("Missing table")?;
                if !self.extension_registry.plugin_owns_table(&self.plugin_id, table) {
                    return Err(format!("Plugin does not own table: {}", table));
                }
                let filters = params_map.get("filters").and_then(|v| v.as_object());
                let aggregations = params_map["aggregations"]
                    .as_object()
                    .ok_or("Missing or invalid aggregations object")?;
                self.db
                    .plugin_aggregate_table(table, filters, aggregations)
                    .map_err(|e| e.to_string())
            }
            _ => Err(format!("Unknown database method: {}", method))
        }
    }
    
    fn query_plugin_table(
        &self,
        plugin_id: &str,
        table: &str,
        filters: Option<serde_json::Value>,
        order_by: Option<&str>,
        limit: Option<i64>,
    ) -> Result<serde_json::Value, String> {
        // 1. Validate plugin_id exists and is installed
        if !self.db.is_plugin_installed(plugin_id)
            .map_err(|e| format!("Failed to check plugin installation: {}", e))? {
            return Err(format!("Plugin {} is not installed", plugin_id));
        }
        
        // 2. Validate table ownership via extension_registry.get_table_owner()
        let table_owner = self.extension_registry.get_table_owner(table)
            .ok_or_else(|| format!("Table {} does not exist or is a core table", table))?;
        
        if table_owner != plugin_id {
            return Err(format!("Table {} is not owned by plugin {}", table, plugin_id));
        }
        
        // 3. Check permissions via extension_registry.can_query_plugin_table()
        if !self.extension_registry.can_query_plugin_table(&self.plugin_id, plugin_id, table) {
            return Err(format!(
                "Permission denied: plugin {} is not allowed to query table {} from plugin {}",
                self.plugin_id, table, plugin_id
            ));
        }
        
        // 4. Call db.plugin_select_table() with same parameters as own tables
        // Convert filters from Option<serde_json::Value> to Option<&serde_json::Map<String, serde_json::Value>>
        let filters_map = filters.and_then(|v| v.as_object().cloned());
        let filters_ref = filters_map.as_ref();
        
        let rows = self.db
            .plugin_select_table(table, filters_ref, order_by, limit)
            .map_err(|e| format!("Failed to query table: {}", e))?;
        
        // 5. Return results (read-only, no modifications allowed)
        Ok(serde_json::Value::Array(rows))
    }
    
    // ============================================================================
    // Core Application Methods
    // ============================================================================
    
    fn get_categories(&self) -> Result<serde_json::Value, String> {
        let categories = self.db.get_categories_as_json().map_err(|e| e.to_string())?;
        Ok(serde_json::Value::Array(categories))
    }
    
    fn create_category(&self, params: serde_json::Value) -> Result<serde_json::Value, String> {
        let params_map = params.as_object().ok_or("Params must be an object")?;
        let name = params_map["name"].as_str().ok_or("Missing name")?.to_string();
        let color = params_map["color"].as_str().unwrap_or("#888888").to_string();
        let icon = params_map["icon"].as_str().map(|s| s.to_string());
        let is_productive = params_map["is_productive"].as_bool();
        let sort_order = params_map["sort_order"].as_i64().unwrap_or(0);
        let is_system = params_map["is_system"].as_bool().unwrap_or(false);
        let is_pinned = params_map["is_pinned"].as_bool().unwrap_or(false);

        let id = self.db.create_category_core(
            &name,
            &color,
            icon.as_deref(),
            is_productive,
            sort_order,
            is_system,
            is_pinned,
        ).map_err(|e| e.to_string())?;

        // Write plugin-extended fields (any param key not in core set)
        let core_keys = ["id", "name", "color", "icon", "is_productive", "sort_order", "is_system", "is_pinned"];
        let extended: serde_json::Map<String, serde_json::Value> = params_map
            .iter()
            .filter(|(k, _)| !core_keys.contains(&k.as_str()))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();
        if !extended.is_empty() {
            self.db.update_categories_extended(id, &extended).map_err(|e| e.to_string())?;
        }

        let categories = self.db.get_categories_as_json().map_err(|e| e.to_string())?;
        let category = categories
            .into_iter()
            .find(|c| c.get("id").and_then(|v| v.as_i64()) == Some(id))
            .ok_or_else(|| "Failed to retrieve created category".to_string())?;
        Ok(category)
    }
    
    fn update_category(&self, params: serde_json::Value) -> Result<serde_json::Value, String> {
        let params_map = params.as_object().ok_or("Params must be an object")?;
        let id = params_map["id"].as_i64().ok_or("Missing id")?;
        let name = params_map["name"].as_str().ok_or("Missing name")?.to_string();
        let color = params_map["color"].as_str().unwrap_or("#888888").to_string();
        let icon = params_map["icon"].as_str().map(|s| s.to_string());
        let is_productive = params_map["is_productive"].as_bool();
        let sort_order = params_map["sort_order"].as_i64().unwrap_or(0);
        let is_pinned = params_map["is_pinned"].as_bool();

        let current = self.db.get_categories().map_err(|e| e.to_string())?
            .into_iter()
            .find(|c| c.id == id)
            .ok_or_else(|| "Category not found".to_string())?;

        let is_pinned_bool = is_pinned.unwrap_or(current.is_pinned);

        self.db.update_category_core(
            id,
            &name,
            &color,
            icon.as_deref(),
            is_productive.or(current.is_productive),
            sort_order,
            is_pinned_bool,
        ).map_err(|e| e.to_string())?;

        // Write plugin-extended fields
        let core_keys = ["id", "name", "color", "icon", "is_productive", "sort_order", "is_system", "is_pinned"];
        let extended: serde_json::Map<String, serde_json::Value> = params_map
            .iter()
            .filter(|(k, _)| !core_keys.contains(&k.as_str()))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();
        if !extended.is_empty() {
            self.db.update_categories_extended(id, &extended).map_err(|e| e.to_string())?;
        }

        let categories = self.db.get_categories_as_json().map_err(|e| e.to_string())?;
        let category = categories
            .into_iter()
            .find(|c| c.get("id").and_then(|v| v.as_i64()) == Some(id))
            .ok_or_else(|| "Category not found".to_string())?;
        Ok(category)
    }
    
    fn delete_category(&self, id: i64) -> Result<(), String> {
        self.db.delete_category(id).map_err(|e| e.to_string())?;
        Ok(())
    }
    
    fn get_activities(
        &self,
        start: i64,
        end: i64,
        limit: Option<i64>,
        offset: Option<i64>,
        filters: Option<ActivityFilters>,
    ) -> Result<serde_json::Value, String> {
        let exclude_idle = filters.as_ref().and_then(|f| f.exclude_idle);
        let category_ids = filters.as_ref().and_then(|f| f.category_ids.as_ref().map(|v| v.as_slice()));
        let activities = self
            .db
            .get_activities(start, end, limit, offset, exclude_idle, category_ids)
            .map_err(|e| e.to_string())?;
        Ok(serde_json::to_value(activities).map_err(|e| e.to_string())?)
    }
    
    fn get_manual_entries(&self, start: i64, end: i64) -> Result<serde_json::Value, String> {
        let entries = self.db.get_manual_entries(start, end).map_err(|e| e.to_string())?;
        Ok(serde_json::to_value(entries).map_err(|e| e.to_string())?)
    }
    
    fn create_manual_entry(&self, params: serde_json::Value) -> Result<serde_json::Value, String> {
        let params_map = params.as_object().ok_or("Params must be an object")?;
        let description = params_map["description"].as_str().map(|s| s.to_string());
        let category_id = params_map["category_id"].as_i64();
        let started_at = params_map["started_at"].as_i64().ok_or("Missing started_at")?;
        let ended_at = params_map["ended_at"].as_i64().ok_or("Missing ended_at")?;

        let id = self.db.add_manual_entry(
            description.as_deref(),
            category_id,
            started_at,
            ended_at,
        ).map_err(|e| e.to_string())?;

        let entries = self.db.get_manual_entries(started_at.saturating_sub(1), ended_at.saturating_add(1))
            .map_err(|e| e.to_string())?;
        let entry = entries.into_iter()
            .find(|e| e.id == id)
            .ok_or_else(|| "Failed to retrieve created entry".to_string())?;
        Ok(serde_json::to_value(entry).map_err(|e| e.to_string())?)
    }
    
    fn update_manual_entry(&self, params: serde_json::Value) -> Result<serde_json::Value, String> {
        let params_map = params.as_object().ok_or("Params must be an object")?;
        let id = params_map["id"].as_i64().ok_or("Missing id")?;
        let description = params_map["description"].as_str().map(|s| s.to_string());
        let category_id = params_map["category_id"].as_i64();
        let started_at = params_map["started_at"].as_i64().ok_or("Missing started_at")?;
        let ended_at = params_map["ended_at"].as_i64().ok_or("Missing ended_at")?;

        let current = self.db.get_manual_entries(0, i64::MAX).map_err(|e| e.to_string())?
            .into_iter()
            .find(|e| e.id == id)
            .ok_or_else(|| "Manual entry not found".to_string())?;

        let category_id = category_id.or(current.category_id);
        let description_ref = description
            .as_deref()
            .or(current.description.as_deref());
        self.db.update_manual_entry(
            id,
            description_ref,
            category_id,
            started_at,
            ended_at,
        ).map_err(|e| e.to_string())?;

        let entries = self.db.get_manual_entries(0, i64::MAX).map_err(|e| e.to_string())?;
        let entry = entries.into_iter()
            .find(|e| e.id == id)
            .ok_or_else(|| "Manual entry not found".to_string())?;
        Ok(serde_json::to_value(entry).map_err(|e| e.to_string())?)
    }
    
    fn delete_manual_entry(&self, id: i64) -> Result<(), String> {
        self.db.delete_manual_entry(id).map_err(|e| e.to_string())?;
        Ok(())
    }
    
    // ============================================================================
    // Plugin's Own Table Methods
    // ============================================================================
    
    fn insert_own_table(&self, table: &str, data: serde_json::Value) -> Result<serde_json::Value, String> {
        if !self.extension_registry.plugin_owns_table(&self.plugin_id, table) {
            return Err(format!("Plugin does not own table: {}", table));
        }
        let data_obj = data.as_object().ok_or("Missing or invalid data object")?;
        let id = self.db.plugin_insert_table(table, data_obj).map_err(|e| e.to_string())?;
        Ok(serde_json::json!({ "id": id }))
    }
    
    fn query_own_table(
        &self,
        table: &str,
        filters: Option<serde_json::Value>,
        order_by: Option<&str>,
        limit: Option<i64>,
    ) -> Result<serde_json::Value, String> {
        if !self.extension_registry.plugin_owns_table(&self.plugin_id, table) {
            return Err(format!("Plugin does not own table: {}", table));
        }
        let filters_obj = filters.as_ref().and_then(|v| v.as_object());
        let rows = self
            .db
            .plugin_select_table(table, filters_obj, order_by, limit)
            .map_err(|e| e.to_string())?;
        Ok(serde_json::Value::Array(rows))
    }
    
    fn update_own_table(&self, table: &str, id: i64, data: serde_json::Value) -> Result<serde_json::Value, String> {
        if !self.extension_registry.plugin_owns_table(&self.plugin_id, table) {
            return Err(format!("Plugin does not own table: {}", table));
        }
        let data_obj = data.as_object().ok_or("Missing or invalid data object")?;
        let n = self
            .db
            .plugin_update_table(table, id, data_obj)
            .map_err(|e| e.to_string())?;
        Ok(serde_json::json!({ "updated": n }))
    }
    
    fn delete_own_table(&self, table: &str, id: i64) -> Result<serde_json::Value, String> {
        if !self.extension_registry.plugin_owns_table(&self.plugin_id, table) {
            return Err(format!("Plugin does not own table: {}", table));
        }
        let n = self
            .db
            .plugin_delete_table(table, id)
            .map_err(|e| e.to_string())?;
        Ok(serde_json::json!({ "deleted": n }))
    }
    
    fn aggregate_own_table(
        &self,
        table: &str,
        filters: Option<serde_json::Value>,
        aggregations: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        if !self.extension_registry.plugin_owns_table(&self.plugin_id, table) {
            return Err(format!("Plugin does not own table: {}", table));
        }
        let filters_obj = filters.as_ref().and_then(|v| v.as_object());
        let aggregations_obj = aggregations.as_object().ok_or("Missing or invalid aggregations object")?;
        self.db
            .plugin_aggregate_table(table, filters_obj, aggregations_obj)
            .map_err(|e| e.to_string())
    }
}
