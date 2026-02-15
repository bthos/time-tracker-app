//! Export commands

use crate::commands::common::AppState;
use chrono::{Utc, TimeZone};
use tauri::State;
use std::fs::File;
use std::io::Write;

/// Export to CSV
#[tauri::command]
pub fn export_to_csv(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
    file_path: String,
) -> Result<(), String> {
    let activities = state.db.get_activities(start, end, None, None, None, None).map_err(|e| e.to_string())?;
    let categories = state.db.get_categories().map_err(|e| e.to_string())?;
    
    let mut file = File::create(&file_path)
        .map_err(|e| format!("Failed to create CSV file: {}", e))?;
    
    file.write_all(&[0xEF, 0xBB, 0xBF])
        .map_err(|e| format!("Failed to write UTF-8 BOM: {}", e))?;
    
    let mut wtr = csv::Writer::from_writer(file);
    
    wtr.write_record(&["id", "app_name", "window_title", "category", "started_at", "duration", "is_idle"])
        .map_err(|e| format!("Failed to write CSV header: {}", e))?;
    
    for activity in &activities {
        let category_name = activity.category_id
            .and_then(|id| categories.iter().find(|c| c.id == id))
            .map(|c| c.name.clone())
            .unwrap_or_else(|| "Uncategorized".to_string());
        
        let started_at_dt = Utc.timestamp_opt(activity.started_at, 0)
            .single()
            .ok_or_else(|| format!("Invalid timestamp: {}", activity.started_at))?;
        let started_at_formatted = started_at_dt.format("%Y-%m-%d %H:%M:%S").to_string();
        
        let hours = activity.duration_sec / 3600;
        let minutes = (activity.duration_sec % 3600) / 60;
        let seconds = activity.duration_sec % 60;
        let duration_formatted = format!("{:02}:{:02}:{:02}", hours, minutes, seconds);
        
        wtr.write_record(&[
            activity.id.to_string(),
            activity.app_name.clone(),
            activity.window_title.clone().unwrap_or_else(|| "".to_string()),
            category_name,
            started_at_formatted,
            duration_formatted,
            activity.is_idle.to_string(),
        ]).map_err(|e| format!("Failed to write CSV row: {}", e))?;
    }
    
    wtr.flush().map_err(|e| format!("Failed to flush CSV: {}", e))?;
    Ok(())
}

/// Export to JSON
#[tauri::command]
pub fn export_to_json(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
    file_path: String,
) -> Result<(), String> {
    let activities = state.db.get_activities(start, end, None, None, None, None).map_err(|e| e.to_string())?;
    
    let json = serde_json::to_string_pretty(&activities)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;
    
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write JSON file: {}", e))?;
    
    Ok(())
}
