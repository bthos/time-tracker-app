//! Tracking control commands

use crate::commands::common::AppState;
use chrono::Utc;
use tauri::State;

/// Get today's total tracked time
#[tauri::command]
pub fn get_today_total(state: State<'_, AppState>) -> Result<i64, String> {
    let now = Utc::now().timestamp();
    let start_of_day = Utc::now()
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
        .timestamp();
    
    let activities = state.db.get_activities(start_of_day, now, None, None, None, None)
        .map_err(|e| e.to_string())?;
    
    let total: i64 = activities.iter().map(|a| a.duration_sec).sum();
    Ok(total)
}

/// Pause tracking
#[tauri::command]
pub fn pause_tracking(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(tracker) = state.tracker.lock().unwrap().as_ref() {
        tracker.pause();
    }
    Ok(())
}

/// Resume tracking
#[tauri::command]
pub fn resume_tracking(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(tracker) = state.tracker.lock().unwrap().as_ref() {
        tracker.resume();
    }
    Ok(())
}

/// Get tracking status
#[tauri::command]
pub fn get_tracking_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let (is_running, is_paused, current_app) = if let Some(tracker) = state.tracker.lock().unwrap().as_ref() {
        let is_running = tracker.is_running();
        let is_paused = tracker.is_paused();
        let current_app = if !is_paused { tracker.get_current_app() } else { None };
        (is_running, is_paused, current_app)
    } else {
        (false, false, None)
    };

    let active_session_duration: Option<i64> = state
        .db
        .get_last_activity_today()
        .ok()
        .flatten()
        .and_then(|(_, started_at, duration_sec, _)| {
            let now = Utc::now().timestamp();
            if now - started_at < 300 {
                Some(duration_sec + (now - started_at))
            } else {
                None
            }
        });

    Ok(serde_json::json!({
        "isTracking": is_running,
        "isPaused": is_paused,
        "currentApp": current_app,
        "activeSessionDuration": active_session_duration,
    }))
}

/// Start thinking mode
#[tauri::command]
pub fn start_thinking_mode(
    state: State<'_, AppState>,
) -> Result<i64, String> {
    if let Some(tracker) = state.tracker.lock().unwrap().as_ref() {
        tracker.pause();
    }
    
    let thinking_category_id = state
        .db
        .find_category_by_name("Thinking")
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Thinking category not found".to_string())?;
    
    crate::commands::manual_entries::start_manual_entry(state, thinking_category_id, Some("Thinking mode".to_string()))
}

/// Stop thinking mode
#[tauri::command]
pub fn stop_thinking_mode(state: State<'_, AppState>) -> Result<(), String> {
    let entry_id = state.thinking_mode_entry_id.lock().unwrap().take()
        .ok_or_else(|| "No active manual entry".to_string())?;
    
    let now = Utc::now().timestamp();
    
    let entry = state
        .db
        .get_manual_entries(now - 86400, now + 86400)
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|e| e.id == entry_id)
        .ok_or_else(|| "Entry not found".to_string())?;
    
    state
        .db
        .update_manual_entry(
            entry_id,
            entry.description.as_deref(),
            entry.category_id,
            entry.started_at,
            now,
        )
        .map_err(|e| e.to_string())?;
    
    if let Some(tracker) = state.tracker.lock().unwrap().as_ref() {
        tracker.resume();
    }
    
    Ok(())
}
