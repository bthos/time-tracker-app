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
    QueryFilter as SDKQueryFilter
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
                    // Convert CreateTable to multiple AddColumn operations for now
                    // TODO: Update database.rs to handle CreateTable directly
                    SchemaChange::AddColumn {
                        table: table.clone(),
                        column: columns[0].name.clone(),
                        column_type: columns[0].column_type.clone(),
                        default: columns[0].default.clone(),
                        foreign_key: columns[0].foreign_key.clone(),
                    }
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
        // Route database method calls to the appropriate Database method
        // This allows plugins to access database without direct Database dependency
        match method {
            // Project methods
            "create_project" => {
                let name = params["name"].as_str().ok_or("Missing name")?.to_string();
                let client_name = params["client_name"].as_str().map(|s| s.to_string());
                let color = params["color"].as_str().unwrap_or("#888888").to_string();
                let is_billable = params["is_billable"].as_bool().unwrap_or(false);
                let hourly_rate = params["hourly_rate"].as_f64().unwrap_or(0.0);
                let budget_hours = params["budget_hours"].as_f64();
                
                let id = self.db.create_project(
                    &name,
                    client_name.as_deref(),
                    &color,
                    is_billable,
                    hourly_rate,
                    budget_hours,
                ).map_err(|e| e.to_string())?;
                
                let project = self.db.get_project_by_id(id)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "Failed to retrieve created project".to_string())?;
                
                Ok(serde_json::to_value(project).map_err(|e| e.to_string())?)
            }
            "get_projects" => {
                let include_archived = params["include_archived"].as_bool().unwrap_or(false);
                let projects = self.db.get_projects(include_archived)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(projects).map_err(|e| e.to_string())?)
            }
            "get_project_by_id" => {
                let id = params["id"].as_i64().ok_or("Missing id")?;
                let project = self.db.get_project_by_id(id)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(project).map_err(|e| e.to_string())?)
            }
            "update_project" => {
                let id = params["id"].as_i64().ok_or("Missing id")?;
                let name = params["name"].as_str().ok_or("Missing name")?.to_string();
                let client_name = params["client_name"].as_str().map(|s| s.to_string());
                let color = params["color"].as_str().unwrap_or("#888888").to_string();
                let is_billable = params["is_billable"].as_bool().unwrap_or(false);
                let hourly_rate = params["hourly_rate"].as_f64().unwrap_or(0.0);
                let budget_hours = params["budget_hours"].as_f64();
                let is_archived = params["is_archived"].as_bool();
                
                self.db.update_project(
                    id,
                    &name,
                    client_name.as_deref(),
                    &color,
                    is_billable,
                    hourly_rate,
                    budget_hours,
                    is_archived,
                ).map_err(|e| e.to_string())?;
                
                let project = self.db.get_project_by_id(id)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "Project not found".to_string())?;
                
                Ok(serde_json::to_value(project).map_err(|e| e.to_string())?)
            }
            "delete_project" => {
                let id = params["id"].as_i64().ok_or("Missing id")?;
                self.db.delete_project(id).map_err(|e| e.to_string())?;
                Ok(serde_json::json!({}))
            }
            // Task methods
            "create_task" => {
                let project_id = params["project_id"].as_i64().ok_or("Missing project_id")?;
                let name = params["name"].as_str().ok_or("Missing name")?.to_string();
                let description = params["description"].as_str().map(|s| s.to_string());
                
                let id = self.db.create_task(project_id, &name, description.as_deref())
                    .map_err(|e| e.to_string())?;
                
                let task = self.db.get_task_by_id(id)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "Failed to retrieve created task".to_string())?;
                
                Ok(serde_json::to_value(task).map_err(|e| e.to_string())?)
            }
            "get_tasks" => {
                let project_id = params["project_id"].as_i64();
                let include_archived = params["include_archived"].as_bool().unwrap_or(false);
                let tasks = self.db.get_tasks(project_id, include_archived)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(tasks).map_err(|e| e.to_string())?)
            }
            "get_task_by_id" => {
                let id = params["id"].as_i64().ok_or("Missing id")?;
                let task = self.db.get_task_by_id(id)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(task).map_err(|e| e.to_string())?)
            }
            "update_task" => {
                let id = params["id"].as_i64().ok_or("Missing id")?;
                let name = params["name"].as_str().ok_or("Missing name")?.to_string();
                let description = params["description"].as_str().map(|s| s.to_string());
                let is_archived = params["is_archived"].as_bool();
                
                self.db.update_task(id, &name, description.as_deref(), is_archived)
                    .map_err(|e| e.to_string())?;
                
                let task = self.db.get_task_by_id(id)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "Task not found".to_string())?;
                
                Ok(serde_json::to_value(task).map_err(|e| e.to_string())?)
            }
            "delete_task" => {
                let id = params["id"].as_i64().ok_or("Missing id")?;
                self.db.delete_task(id).map_err(|e| e.to_string())?;
                Ok(serde_json::json!({}))
            }
            // Billing methods
            "get_billable_hours" => {
                let start = params["start"].as_i64().ok_or("Missing start")?;
                let end = params["end"].as_i64().ok_or("Missing end")?;
                let hours = self.db.get_billable_hours(start, end)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::json!(hours))
            }
            "get_billable_revenue" => {
                let start = params["start"].as_i64().ok_or("Missing start")?;
                let end = params["end"].as_i64().ok_or("Missing end")?;
                let revenue = self.db.get_billable_revenue(start, end)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::json!(revenue))
            }
            // Pomodoro methods
            "create_focus_session" => {
                let pomodoro_type = params["pomodoro_type"].as_str().unwrap_or("work").to_string();
                let project_id = params["project_id"].as_i64();
                let task_id = params["task_id"].as_i64();
                
                let id = self.db.create_focus_session(&pomodoro_type, project_id, task_id)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::json!(id))
            }
            "update_focus_session" => {
                let id = params["id"].as_i64().ok_or("Missing id")?;
                let duration_sec = params["duration_sec"].as_i64().ok_or("Missing duration_sec")?;
                let completed = params["completed"].as_bool().unwrap_or(false);
                
                self.db.update_focus_session(id, duration_sec, completed)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::json!({}))
            }
            "get_completed_work_sessions_count_today" => {
                let count = self.db.get_completed_work_sessions_count_today()
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::json!(count))
            }
            "get_focus_sessions" => {
                let start = params["start"].as_i64().ok_or("Missing start")?;
                let end = params["end"].as_i64().ok_or("Missing end")?;
                let sessions = self.db.get_focus_sessions(start, end)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(sessions).map_err(|e| e.to_string())?)
            }
            "get_active_focus_session" => {
                let session = self.db.get_active_focus_session()
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(session).map_err(|e| e.to_string())?)
            }
            "delete_focus_session" => {
                let id = params["id"].as_i64().ok_or("Missing id")?;
                self.db.delete_focus_session(id).map_err(|e| e.to_string())?;
                Ok(serde_json::json!({}))
            }
            // Goals methods
            "create_goal" => {
                let goal_type = params["goal_type"].as_str().ok_or("Missing goal_type")?.to_string();
                let target_seconds = params["target_seconds"].as_i64().ok_or("Missing target_seconds")?;
                let category_id = params["category_id"].as_i64();
                let project_id = params["project_id"].as_i64();
                let start_date = params["start_date"].as_i64().ok_or("Missing start_date")?;
                let end_date = params["end_date"].as_i64();
                let name = params["name"].as_str().map(|s| s.to_string());
                
                let id = self.db.create_goal(
                    &goal_type,
                    target_seconds,
                    category_id,
                    project_id,
                    start_date,
                    end_date,
                    name.as_deref(),
                ).map_err(|e| e.to_string())?;
                Ok(serde_json::json!(id))
            }
            "get_goals" => {
                let active_only = params["active_only"].as_bool().unwrap_or(false);
                let goals = self.db.get_goals(active_only)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(goals).map_err(|e| e.to_string())?)
            }
            "update_goal" => {
                let id = params["id"].as_i64().ok_or("Missing id")?;
                let goal_type = params["goal_type"].as_str().ok_or("Missing goal_type")?.to_string();
                let target_seconds = params["target_seconds"].as_i64().ok_or("Missing target_seconds")?;
                let category_id = params["category_id"].as_i64();
                let project_id = params["project_id"].as_i64();
                let start_date = params["start_date"].as_i64().ok_or("Missing start_date")?;
                let end_date = params["end_date"].as_i64();
                let active = params["active"].as_bool().unwrap_or(true);
                let name = params["name"].as_str().map(|s| s.to_string());
                
                self.db.update_goal(
                    id,
                    &goal_type,
                    target_seconds,
                    category_id,
                    project_id,
                    start_date,
                    end_date,
                    active,
                    name.as_deref(),
                ).map_err(|e| e.to_string())?;
                
                // Return updated goal by finding it in the list
                let goals = self.db.get_goals(false)
                    .map_err(|e| e.to_string())?;
                let goal = goals.into_iter()
                    .find(|g| g.id == id)
                    .ok_or_else(|| "Goal not found".to_string())?;
                
                Ok(serde_json::to_value(goal).map_err(|e| e.to_string())?)
            }
            "delete_goal" => {
                let id = params["id"].as_i64().ok_or("Missing id")?;
                self.db.delete_goal(id).map_err(|e| e.to_string())?;
                Ok(serde_json::json!({}))
            }
            "get_goal_progress" => {
                let goal_id = params["goal_id"].as_i64().ok_or("Missing goal_id")?;
                let start = params["start"].as_i64().ok_or("Missing start")?;
                let end = params["end"].as_i64().ok_or("Missing end")?;
                let progress = self.db.get_goal_progress(goal_id, start, end)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(progress).map_err(|e| e.to_string())?)
            }
            "check_goal_alerts" => {
                let alerts = self.db.check_goal_alerts()
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(alerts).map_err(|e| e.to_string())?)
            }
            _ => Err(format!("Unknown database method: {}", method))
        }
    }
}
