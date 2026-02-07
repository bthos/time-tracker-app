//! Billing Plugin
//! 
//! Manages billable time tracking, extends categories with is_billable and hourly_rate fields

use crate::database::Database;
use crate::plugin_system::{Plugin, PluginInfo, PluginAPI};
use crate::plugin_system::extensions::{EntityType, SchemaChange, ModelField};
use std::sync::Arc;
use serde_json;

pub struct BillingPlugin {
    info: PluginInfo,
    db: Arc<Database>,
}

impl BillingPlugin {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            info: PluginInfo {
                id: "billing-plugin".to_string(),
                name: "Billing".to_string(),
                version: "1.0.0".to_string(),
                description: Some("Billable time tracking".to_string()),
                is_builtin: true,
            },
            db,
        }
    }
}

impl Plugin for BillingPlugin {
    fn info(&self) -> &PluginInfo {
        &self.info
    }
    
    fn initialize(&mut self, api: &PluginAPI) -> Result<(), String> {
        // Register schema extensions for categories
        api.register_schema_extension(
            EntityType::Category,
            vec![
                SchemaChange::AddColumn {
                    table: "categories".to_string(),
                    column: "is_billable".to_string(),
                    column_type: "BOOLEAN".to_string(),
                    default: Some("FALSE".to_string()),
                    foreign_key: None,
                },
                SchemaChange::AddColumn {
                    table: "categories".to_string(),
                    column: "hourly_rate".to_string(),
                    column_type: "REAL".to_string(),
                    default: Some("0.0".to_string()),
                    foreign_key: None,
                },
            ],
        )?;
        
        // Register model extensions
        api.register_model_extension(
            EntityType::Category,
            vec![
                ModelField {
                    name: "is_billable".to_string(),
                    type_: "Option<bool>".to_string(),
                    optional: true,
                },
                ModelField {
                    name: "hourly_rate".to_string(),
                    type_: "Option<f64>".to_string(),
                    optional: true,
                },
            ],
        )?;
        
        Ok(())
    }
    
    fn invoke_command(&self, command: &str, params: serde_json::Value) -> Result<serde_json::Value, String> {
        match command {
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
            
            _ => Err(format!("Unknown command: {}", command)),
        }
    }
    
    fn shutdown(&self) -> Result<(), String> {
        Ok(())
    }
}
