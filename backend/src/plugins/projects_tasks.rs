//! Projects/Tasks Plugin
//! 
//! Manages projects and tasks, extends activities and manual_entries with project_id and task_id fields

use crate::database::Database;
use crate::plugin_system::{Plugin, PluginInfo, PluginAPI};
use crate::plugin_system::extensions::{EntityType, SchemaChange, ModelField};
use std::sync::Arc;
use serde_json;

pub struct ProjectsTasksPlugin {
    info: PluginInfo,
    db: Arc<Database>,
}

impl ProjectsTasksPlugin {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            info: PluginInfo {
                id: "projects-tasks-plugin".to_string(),
                name: "Projects/Tasks".to_string(),
                version: "1.0.0".to_string(),
                description: Some("Project and task management".to_string()),
                is_builtin: true,
            },
            db,
        }
    }
}

impl Plugin for ProjectsTasksPlugin {
    fn info(&self) -> &PluginInfo {
        &self.info
    }
    
    fn initialize(&mut self, api: &PluginAPI) -> Result<(), String> {
        // Note: Projects and tasks tables are already created in core database.rs
        // The Extension API will handle adding columns to activities and manual_entries
        // if they don't already exist
        
        // Register schema extensions for activities
        api.register_schema_extension(
            EntityType::Activity,
            vec![
                SchemaChange::AddColumn {
                    table: "activities".to_string(),
                    column: "project_id".to_string(),
                    column_type: "INTEGER".to_string(),
                    default: None,
                    foreign_key: Some(crate::plugin_system::extensions::ForeignKey {
                        table: "projects".to_string(),
                        column: "id".to_string(),
                    }),
                },
                SchemaChange::AddColumn {
                    table: "activities".to_string(),
                    column: "task_id".to_string(),
                    column_type: "INTEGER".to_string(),
                    default: None,
                    foreign_key: Some(crate::plugin_system::extensions::ForeignKey {
                        table: "tasks".to_string(),
                        column: "id".to_string(),
                    }),
                },
                SchemaChange::AddIndex {
                    table: "activities".to_string(),
                    index: "idx_activities_project".to_string(),
                    columns: vec!["project_id".to_string()],
                },
            ],
        )?;
        
        // Register schema extensions for manual_entries
        api.register_schema_extension(
            EntityType::ManualEntry,
            vec![
                SchemaChange::AddColumn {
                    table: "manual_entries".to_string(),
                    column: "project_id".to_string(),
                    column_type: "INTEGER".to_string(),
                    default: None,
                    foreign_key: Some(crate::plugin_system::extensions::ForeignKey {
                        table: "projects".to_string(),
                        column: "id".to_string(),
                    }),
                },
                SchemaChange::AddColumn {
                    table: "manual_entries".to_string(),
                    column: "task_id".to_string(),
                    column_type: "INTEGER".to_string(),
                    default: None,
                    foreign_key: Some(crate::plugin_system::extensions::ForeignKey {
                        table: "tasks".to_string(),
                        column: "id".to_string(),
                    }),
                },
            ],
        )?;
        
        // Register model extensions
        api.register_model_extension(
            EntityType::Activity,
            vec![
                ModelField {
                    name: "project_id".to_string(),
                    type_: "Option<i64>".to_string(),
                    optional: true,
                },
                ModelField {
                    name: "task_id".to_string(),
                    type_: "Option<i64>".to_string(),
                    optional: true,
                },
            ],
        )?;
        
        api.register_model_extension(
            EntityType::ManualEntry,
            vec![
                ModelField {
                    name: "project_id".to_string(),
                    type_: "Option<i64>".to_string(),
                    optional: true,
                },
                ModelField {
                    name: "task_id".to_string(),
                    type_: "Option<i64>".to_string(),
                    optional: true,
                },
            ],
        )?;
        
        Ok(())
    }
    
    fn invoke_command(&self, command: &str, params: serde_json::Value) -> Result<serde_json::Value, String> {
        match command {
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
            
            _ => Err(format!("Unknown command: {}", command)),
        }
    }
    
    fn shutdown(&self) -> Result<(), String> {
        // Cleanup if needed
        Ok(())
    }
}
