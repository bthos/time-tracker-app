//! Pomodoro Plugin
//! 
//! Manages Pomodoro timer and focus sessions

use crate::database::{Database, FocusSession};
use crate::plugin_system::{Plugin, PluginInfo, PluginAPI};
use crate::plugin_system::extensions::{EntityType, SchemaChange};
use std::sync::Arc;
use serde_json;

pub struct PomodoroPlugin {
    info: PluginInfo,
    db: Arc<Database>,
}

impl PomodoroPlugin {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            info: PluginInfo {
                id: "pomodoro-plugin".to_string(),
                name: "Pomodoro".to_string(),
                version: "1.0.0".to_string(),
                description: Some("Pomodoro timer".to_string()),
                is_builtin: true,
            },
            db,
        }
    }
}

impl Plugin for PomodoroPlugin {
    fn info(&self) -> &PluginInfo {
        &self.info
    }
    
    fn initialize(&mut self, api: &PluginAPI) -> Result<(), String> {
        // Note: focus_sessions table is already created in core database.rs
        // The plugin just uses the existing table structure
        
        Ok(())
    }
    
    fn invoke_command(&self, command: &str, params: serde_json::Value) -> Result<serde_json::Value, String> {
        match command {
            "start_pomodoro" => {
                let pomodoro_type = params["pomodoro_type"].as_str().unwrap_or("work").to_string();
                let project_id = params["project_id"].as_i64();
                let task_id = params["task_id"].as_i64();
                
                let id = self.db.create_focus_session(&pomodoro_type, project_id, task_id)
                    .map_err(|e| e.to_string())?;
                
                Ok(serde_json::json!(id))
            }
            
            "stop_pomodoro" => {
                let session_id = params["session_id"].as_i64().ok_or("Missing session_id")?;
                let duration_sec = params["duration_sec"].as_i64().ok_or("Missing duration_sec")?;
                let completed = params["completed"].as_bool().unwrap_or(false);
                
                self.db.update_focus_session(session_id, duration_sec, completed)
                    .map_err(|e| e.to_string())?;
                
                Ok(serde_json::json!({}))
            }
            
            "get_focus_sessions" => {
                let start = params["start"].as_i64().ok_or("Missing start")?;
                let end = params["end"].as_i64().ok_or("Missing end")?;
                let sessions = self.db.get_focus_sessions(start, end)
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(sessions).map_err(|e| e.to_string())?)
            }
            
            "get_completed_work_sessions_count_today" => {
                let count = self.db.get_completed_work_sessions_count_today()
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::json!(count))
            }
            
            "get_active_pomodoro_session" => {
                let session = self.db.get_active_focus_session()
                    .map_err(|e| e.to_string())?;
                Ok(serde_json::to_value(session).map_err(|e| e.to_string())?)
            }
            
            "delete_focus_session" => {
                let id = params["id"].as_i64().ok_or("Missing id")?;
                self.db.delete_focus_session(id).map_err(|e| e.to_string())?;
                Ok(serde_json::json!({}))
            }
            
            _ => Err(format!("Unknown command: {}", command)),
        }
    }
    
    fn shutdown(&self) -> Result<(), String> {
        Ok(())
    }
}
