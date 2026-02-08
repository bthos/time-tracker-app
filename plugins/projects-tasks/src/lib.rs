//! Projects/Tasks Plugin
//! 
//! Manages projects and tasks, extends activities and manual_entries with project_id and task_id fields

use time_tracker_plugin_sdk::{Plugin, PluginInfo, PluginAPIInterface, EntityType, SchemaChange, ModelField, ForeignKey, SchemaExtension};
use serde_json;
use std::sync::Arc;

// Note: This plugin currently depends on Database directly, which won't work for dynamic loading
// TODO: Refactor to use PluginAPI methods only, or extend PluginAPI to provide database access
// For now, this works as a workspace member but needs refactoring for true dynamic loading
use time_tracker_app::database::Database;

pub struct ProjectsTasksPlugin {
    info: PluginInfo,
    db: Option<Arc<Database>>, // Will be None for dynamic plugins, set via initialize
}

impl ProjectsTasksPlugin {
    pub fn new() -> Self {
        Self {
            info: PluginInfo {
                id: "projects-tasks-plugin".to_string(),
                name: "Projects/Tasks".to_string(),
                version: "1.0.0".to_string(),
                description: Some("Project and task management".to_string()),
                is_builtin: false,
            },
            db: None,
        }
    }
}

impl Plugin for ProjectsTasksPlugin {
    fn info(&self) -> &PluginInfo {
        &self.info
    }
    
    fn initialize(&mut self, api: &dyn PluginAPIInterface) -> Result<(), String> {
        // Register schema extensions - plugins create their own tables
        api.register_schema_extension(
            EntityType::Activity,
            vec![
                SchemaChange::CreateTable {
                    table: "projects".to_string(),
                    columns: vec![
                        time_tracker_plugin_sdk::TableColumn {
                            name: "id".to_string(),
                            column_type: "INTEGER".to_string(),
                            primary_key: true,
                            nullable: false,
                            default: None,
                            foreign_key: None,
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "name".to_string(),
                            column_type: "TEXT".to_string(),
                            primary_key: false,
                            nullable: false,
                            default: None,
                            foreign_key: None,
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "client_name".to_string(),
                            column_type: "TEXT".to_string(),
                            primary_key: false,
                            nullable: true,
                            default: None,
                            foreign_key: None,
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "color".to_string(),
                            column_type: "TEXT".to_string(),
                            primary_key: false,
                            nullable: false,
                            default: Some("'#888888'".to_string()),
                            foreign_key: None,
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "is_billable".to_string(),
                            column_type: "BOOLEAN".to_string(),
                            primary_key: false,
                            nullable: false,
                            default: Some("FALSE".to_string()),
                            foreign_key: None,
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "hourly_rate".to_string(),
                            column_type: "REAL".to_string(),
                            primary_key: false,
                            nullable: false,
                            default: Some("0.0".to_string()),
                            foreign_key: None,
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "budget_hours".to_string(),
                            column_type: "REAL".to_string(),
                            primary_key: false,
                            nullable: true,
                            default: None,
                            foreign_key: None,
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "created_at".to_string(),
                            column_type: "INTEGER".to_string(),
                            primary_key: false,
                            nullable: false,
                            default: None,
                            foreign_key: None,
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "archived".to_string(),
                            column_type: "BOOLEAN".to_string(),
                            primary_key: false,
                            nullable: false,
                            default: Some("FALSE".to_string()),
                            foreign_key: None,
                        },
                    ],
                },
                SchemaChange::CreateTable {
                    table: "tasks".to_string(),
                    columns: vec![
                        time_tracker_plugin_sdk::TableColumn {
                            name: "id".to_string(),
                            column_type: "INTEGER".to_string(),
                            primary_key: true,
                            nullable: false,
                            default: None,
                            foreign_key: None,
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "project_id".to_string(),
                            column_type: "INTEGER".to_string(),
                            primary_key: false,
                            nullable: false,
                            default: None,
                            foreign_key: Some(ForeignKey {
                                table: "projects".to_string(),
                                column: "id".to_string(),
                            }),
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "name".to_string(),
                            column_type: "TEXT".to_string(),
                            primary_key: false,
                            nullable: false,
                            default: None,
                            foreign_key: None,
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "description".to_string(),
                            column_type: "TEXT".to_string(),
                            primary_key: false,
                            nullable: true,
                            default: None,
                            foreign_key: None,
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "created_at".to_string(),
                            column_type: "INTEGER".to_string(),
                            primary_key: false,
                            nullable: false,
                            default: None,
                            foreign_key: None,
                        },
                        time_tracker_plugin_sdk::TableColumn {
                            name: "archived".to_string(),
                            column_type: "BOOLEAN".to_string(),
                            primary_key: false,
                            nullable: false,
                            default: Some("FALSE".to_string()),
                            foreign_key: None,
                        },
                    ],
                },
                SchemaChange::AddIndex {
                    table: "projects".to_string(),
                    index: "idx_projects_archived".to_string(),
                    columns: vec!["archived".to_string()],
                },
                SchemaChange::AddIndex {
                    table: "tasks".to_string(),
                    index: "idx_tasks_project".to_string(),
                    columns: vec!["project_id".to_string()],
                },
                SchemaChange::AddIndex {
                    table: "tasks".to_string(),
                    index: "idx_tasks_archived".to_string(),
                    columns: vec!["archived".to_string()],
                },
                // Add columns to activities
                SchemaChange::AddColumn {
                    table: "activities".to_string(),
                    column: "project_id".to_string(),
                    column_type: "INTEGER".to_string(),
                    default: None,
                    foreign_key: Some(ForeignKey {
                        table: "projects".to_string(),
                        column: "id".to_string(),
                    }),
                },
                SchemaChange::AddColumn {
                    table: "activities".to_string(),
                    column: "task_id".to_string(),
                    column_type: "INTEGER".to_string(),
                    default: None,
                    foreign_key: Some(ForeignKey {
                        table: "tasks".to_string(),
                        column: "id".to_string(),
                    }),
                },
                SchemaChange::AddIndex {
                    table: "activities".to_string(),
                    index: "idx_activities_project".to_string(),
                    columns: vec!["project_id".to_string()],
                },
                // Add columns to manual_entries
                SchemaChange::AddColumn {
                    table: "manual_entries".to_string(),
                    column: "project_id".to_string(),
                    column_type: "INTEGER".to_string(),
                    default: None,
                    foreign_key: Some(ForeignKey {
                        table: "projects".to_string(),
                        column: "id".to_string(),
                    }),
                },
                SchemaChange::AddColumn {
                    table: "manual_entries".to_string(),
                    column: "task_id".to_string(),
                    column_type: "INTEGER".to_string(),
                    default: None,
                    foreign_key: Some(ForeignKey {
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
        // TODO: This needs to use PluginAPI methods instead of Database directly
        // For now, return error indicating this needs refactoring
        Err(format!("Plugin commands not yet implemented - needs PluginAPI database access methods. Command: {}", command))
    }
    
    fn shutdown(&self) -> Result<(), String> {
        Ok(())
    }
    
    fn get_schema_extensions(&self) -> Vec<SchemaExtension> {
        // Schema extensions are registered in initialize()
        vec![]
    }
}

// FFI exports for dynamic loading
#[no_mangle]
pub extern "C" fn _plugin_create() -> *mut dyn Plugin {
    Box::into_raw(Box::new(ProjectsTasksPlugin::new()))
}

#[no_mangle]
pub extern "C" fn _plugin_destroy(plugin: *mut dyn Plugin) {
    unsafe {
        let _ = Box::from_raw(plugin);
    }
}
