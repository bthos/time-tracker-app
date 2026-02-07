//! Tauri commands - IPC handlers for frontend communication

use crate::database::{Activity, Category, Database, ManualEntry, Rule, Project, Task, FocusSession, Goal, GoalProgress, GoalAlert, DomainStat, RangeStats};
use std::sync::Arc;
use std::sync::Mutex;
use tauri::State;
use serde::{Deserialize, Serialize};
use chrono::{Utc, TimeZone, Local};

/// Convert i32 from frontend (-1 = null, 0 = false, 1 = true) to Option<bool>.
fn i32_to_opt_bool(val: i32) -> Option<bool> {
    match val {
        0 => Some(false),
        1 => Some(true),
        _ => None,
    }
}

/// Application state containing database reference
pub struct AppState {
    pub db: Arc<Database>,
    pub tracker: Arc<Mutex<Option<Arc<crate::tracker::Tracker>>>>,
    pub thinking_mode_entry_id: Arc<Mutex<Option<i64>>>,
    pub active_project_id: Arc<Mutex<Option<i64>>>,
    pub active_task_id: Arc<Mutex<Option<i64>>>,
}

/// Get activities for a time range
#[tauri::command]
pub fn get_activities(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
) -> Result<Vec<Activity>, String> {
    state
        .db
        .get_activities(start, end)
        .map_err(|e| e.to_string())
}

/// Get all categories
#[tauri::command]
pub fn get_categories(state: State<'_, AppState>) -> Result<Vec<Category>, String> {
    state.db.get_categories().map_err(|e| e.to_string())
}

/// Get all rules
#[tauri::command]
pub fn get_rules(state: State<'_, AppState>) -> Result<Vec<Rule>, String> {
    state.db.get_rules().map_err(|e| e.to_string())
}

/// Add a new rule
#[tauri::command]
pub fn add_rule(
    state: State<'_, AppState>,
    rule_type: String,
    pattern: String,
    category_id: i64,
    priority: i64,
) -> Result<i64, String> {
    state
        .db
        .add_rule(&rule_type, &pattern, category_id, priority)
        .map_err(|e| e.to_string())
}

/// Delete a rule
#[tauri::command]
pub fn delete_rule(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.delete_rule(id).map_err(|e| e.to_string())
}

/// Add manual entry
#[tauri::command]
pub fn add_manual_entry(
    state: State<'_, AppState>,
    description: Option<String>,
    category_id: Option<i64>,
    started_at: i64,
    ended_at: i64,
    project_id: Option<i64>,
    task_id: Option<i64>,
) -> Result<i64, String> {
    state
        .db
        .add_manual_entry(
            description.as_deref(),
            category_id,
            started_at,
            ended_at,
            project_id,
            task_id,
        )
        .map_err(|e| e.to_string())
}

/// Get manual entries for a time range
#[tauri::command]
pub fn get_manual_entries(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
) -> Result<Vec<ManualEntry>, String> {
    state
        .db
        .get_manual_entries(start, end)
        .map_err(|e| e.to_string())
}

/// Submit idle activity (from idle prompt)
/// Updates the existing idle activity with category and description instead of creating a manual entry
#[tauri::command]
pub fn submit_idle_activity(
    state: State<'_, AppState>,
    category_id: i64,
    comment: Option<String>,
    started_at: i64,
) -> Result<(), String> {
    state
        .db
        .update_idle_activity(
            started_at,
            category_id,
            comment.as_deref(),
        )
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get today's total tracked time
#[tauri::command]
pub fn get_today_total(state: State<'_, AppState>) -> Result<i64, String> {
    let base_total = state.db.get_today_total().map_err(|e| e.to_string())?;
    
    // Check if tracker is active and get current app
    let (is_tracking_active, is_paused, current_app) = if let Some(tracker) = state.tracker.lock().unwrap().as_ref() {
        let is_running = tracker.is_running();
        let is_paused = tracker.is_paused();
        let current_app = if !is_paused { tracker.get_current_app() } else { None };
        (is_running, is_paused, current_app)
    } else {
        (false, false, None)
    };
    
    // Get last activity started today
    let today_start = Local::now()
        .date_naive()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_local_timezone(Local)
        .unwrap()
        .timestamp();
    
    let last_activity = state.db.get_last_activity_today().map_err(|e| e.to_string())?;
    
    // If tracking is active, not paused, and last activity matches current app and started today, add the difference
    // between current duration and stored duration (to account for time since last DB update)
    let mut total = base_total;
    if is_tracking_active && !is_paused {
        if let Some((_id, started_at, stored_duration, app_name)) = &last_activity {
            if let Some(ref current_app_name) = current_app {
                // If last activity matches current app and started today, it's still active
                // Add the difference between current time and stored duration
                if app_name == current_app_name && *started_at >= today_start {
                    let now_ts = Utc::now().timestamp();
                    let current_duration = now_ts - *started_at;
                    let duration_diff = current_duration - *stored_duration;
                    // Only add positive difference (avoid negative values if DB was updated between calls)
                    if duration_diff > 0 {
                        total += duration_diff;
                    }
                }
            }
        }
    }
    
    Ok(total)
}

/// Get setting value
#[tauri::command]
pub fn get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    state.db.get_setting(&key).map_err(|e| e.to_string())
}

/// Set setting value
#[tauri::command]
pub fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    state.db.set_setting(&key, &value).map_err(|e| e.to_string())
}

/// Get aggregated stats for a time range (SQL aggregation)
#[tauri::command]
pub fn get_stats(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
) -> Result<StatsResponse, String> {
    let RangeStats {
        total_seconds,
        productive_seconds,
        category_breakdown: category_rows,
        app_breakdown: app_rows,
    } = state.db.get_stats_for_range(start, end).map_err(|e| e.to_string())?;

    let category_breakdown: Vec<CategoryTime> = category_rows
        .into_iter()
        .map(|(category_id, category_name, color, seconds)| CategoryTime {
            category_id,
            category_name,
            color,
            seconds,
        })
        .collect();

    let app_breakdown: Vec<AppTime> = app_rows
        .into_iter()
        .map(|(app_name, seconds)| AppTime { app_name, seconds })
        .collect();

    Ok(StatsResponse {
        total_seconds,
        productive_seconds,
        category_breakdown,
        app_breakdown,
    })
}

/// Stats response structure
#[derive(serde::Serialize)]
pub struct StatsResponse {
    pub total_seconds: i64,
    pub productive_seconds: i64,
    pub category_breakdown: Vec<CategoryTime>,
    pub app_breakdown: Vec<AppTime>,
}

#[derive(serde::Serialize)]
pub struct CategoryTime {
    pub category_id: i64,
    pub category_name: String,
    pub color: String,
    pub seconds: i64,
}

#[derive(serde::Serialize)]
pub struct AppTime {
    pub app_name: String,
    pub seconds: i64,
}

/// Get activity by ID
#[tauri::command]
pub fn get_activity(
    state: State<'_, AppState>,
    id: i64,
) -> Result<Option<Activity>, String> {
    state
        .db
        .get_activity_by_id(id)
        .map_err(|e| e.to_string())
}

/// Update activity category
#[tauri::command]
pub fn update_activity_category(
    state: State<'_, AppState>,
    activity_id: i64,
    category_id: Option<i64>,
) -> Result<(), String> {
    state
        .db
        .update_activity_category(activity_id, category_id)
        .map_err(|e| e.to_string())
}

/// Delete activity
#[tauri::command]
pub fn delete_activity(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.delete_activity(id).map_err(|e| e.to_string())
}

/// Reapply categorization rules to all activities
#[tauri::command]
pub fn reapply_categorization_rules(state: State<'_, AppState>) -> Result<(), String> {
    state.db.reapply_categorization_rules().map_err(|e| e.to_string())
}

/// Create category
/// Принимает is_productive и is_billable как i32 (-1 для null/neutral, 0 для false, 1 для true)
/// и конвертирует их в Option<bool> для избежания проблем с десериализацией Option<bool> в Tauri
/// Tauri автоматически конвертирует camelCase (sortOrder) в snake_case (sort_order)
#[tauri::command]
pub fn create_category(
    state: State<'_, AppState>,
    name: String,
    color: String,
    icon: Option<String>,
    is_productive: i32,
    is_billable: i32,
    hourly_rate: Option<f64>,
    sort_order: i64,
    is_system: Option<bool>,
    is_pinned: Option<bool>,
    project_id: Option<i64>,
    task_id: Option<i64>,
) -> Result<Category, String> {
    // Конвертируем числа в Option<bool>: 1 -> Some(true), 0 -> Some(false), -1 -> None
    let is_productive_bool = if is_productive == -1 {
        None
    } else {
        Some(is_productive == 1)
    };
    
    let is_billable_bool = if is_billable == -1 {
        None
    } else {
        Some(is_billable == 1)
    };
    
    let is_system_bool = is_system.unwrap_or(false);
    let is_pinned_bool = is_pinned.unwrap_or(false);
    
    let id = state
        .db
        .create_category(&name, &color, icon.as_deref(), is_productive_bool, is_billable_bool, hourly_rate, sort_order, is_system_bool, is_pinned_bool, project_id, task_id)
        .map_err(|e| e.to_string())?;
    
    // Return the created category
    state
        .db
        .get_categories()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Failed to retrieve created category".to_string())
}

/// Update category
/// Принимает is_productive и is_billable как i32 (-1 для null/neutral, 0 для false, 1 для true)
/// и конвертирует их в Option<bool> для избежания проблем с десериализацией Option<bool> в Tauri
/// Tauri автоматически конвертирует camelCase (sortOrder) в snake_case (sort_order)
#[tauri::command]
pub fn update_category(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    color: String,
    icon: Option<String>,
    is_productive: i32,
    is_billable: i32,
    hourly_rate: Option<f64>,
    sort_order: i64,
    is_pinned: Option<bool>,
    project_id: Option<i64>,
    task_id: Option<i64>,
) -> Result<Category, String> {
    let is_productive_bool = i32_to_opt_bool(is_productive);
    let is_billable_bool = i32_to_opt_bool(is_billable);

    // Get current category to preserve is_pinned if not provided
    let current_category = state
        .db
        .get_categories()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Category not found".to_string())?;
    
    let is_pinned_bool = is_pinned.unwrap_or(current_category.is_pinned);
    
    state
        .db
        .update_category(id, &name, &color, icon.as_deref(), is_productive_bool, is_billable_bool, hourly_rate, sort_order, is_pinned_bool, project_id, task_id)
        .map_err(|e| e.to_string())?;
    
    state
        .db
        .get_categories()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Category not found".to_string())
}

/// Delete category
#[tauri::command]
pub fn delete_category(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.delete_category(id).map_err(|e| e.to_string())
}

/// Reset system category to default values
#[tauri::command]
pub fn reset_system_category(state: State<'_, AppState>, id: i64) -> Result<Category, String> {
    state.db.reset_system_category(id).map_err(|e| e.to_string())?;
    
    state
        .db
        .get_categories()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Category not found".to_string())
}

/// Create rule
#[tauri::command]
pub fn create_rule(
    state: State<'_, AppState>,
    rule_type: String,
    pattern: String,
    category_id: i64,
    priority: i64,
) -> Result<Rule, String> {
    let id = state
        .db
        .add_rule(&rule_type, &pattern, category_id, priority)
        .map_err(|e| e.to_string())?;
    
    state
        .db
        .get_rules()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|r| r.id == id)
        .ok_or_else(|| "Failed to retrieve created rule".to_string())
}

/// Update rule
#[tauri::command]
pub fn update_rule(
    state: State<'_, AppState>,
    id: i64,
    rule_type: String,
    pattern: String,
    category_id: i64,
    priority: i64,
) -> Result<Rule, String> {
    state
        .db
        .update_rule(id, &rule_type, &pattern, category_id, priority)
        .map_err(|e| e.to_string())?;
    
    state
        .db
        .get_rules()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|r| r.id == id)
        .ok_or_else(|| "Rule not found".to_string())
}

/// Create manual entry
#[tauri::command]
pub fn create_manual_entry(
    state: State<'_, AppState>,
    description: Option<String>,
    category_id: Option<i64>,
    _project: Option<String>,
    started_at: i64,
    ended_at: i64,
    project_id: Option<i64>,
    task_id: Option<i64>,
) -> Result<ManualEntry, String> {
    let id = state
        .db
        .add_manual_entry(
            description.as_deref(),
            category_id,
            started_at,
            ended_at,
            project_id,
            task_id,
        )
        .map_err(|e| e.to_string())?;
    
    // Return the created entry
    let entries = state
        .db
        .get_manual_entries(started_at - 1, ended_at + 1)
        .map_err(|e| e.to_string())?;
    
    entries
        .into_iter()
        .find(|e| e.id == id)
        .ok_or_else(|| "Failed to retrieve created entry".to_string())
}

/// Update manual entry
#[tauri::command]
pub fn update_manual_entry(
    state: State<'_, AppState>,
    id: i64,
    description: Option<String>,
    category_id: Option<i64>,
    project: Option<String>,
    started_at: i64,
    ended_at: i64,
    project_id: Option<i64>,
    task_id: Option<i64>,
) -> Result<ManualEntry, String> {
    state
        .db
        .update_manual_entry(
            id,
            description.as_deref(),
            category_id,
            project.as_deref(),
            project_id,
            task_id,
            started_at,
            ended_at,
        )
        .map_err(|e| e.to_string())?;
    
    let entries = state
        .db
        .get_manual_entries(started_at - 1, ended_at + 1)
        .map_err(|e| e.to_string())?;
    
    entries
        .into_iter()
        .find(|e| e.id == id)
        .ok_or_else(|| "Entry not found".to_string())
}

/// Delete manual entry
#[tauri::command]
pub fn delete_manual_entry(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.delete_manual_entry(id).map_err(|e| e.to_string())
}

/// Start manual entry (for thinking mode, etc.)
#[tauri::command]
pub fn start_manual_entry(
    state: State<'_, AppState>,
    category_id: i64,
    description: Option<String>,
) -> Result<i64, String> {
    let now = Utc::now().timestamp();
    let id = state
        .db
        .add_manual_entry(
            description.as_deref(),
            Some(category_id),
            now,
            now, // Will be updated when stopped
            None, // project_id
            None, // task_id
        )
        .map_err(|e| e.to_string())?;
    
    // Store the entry ID for later update
    *state.thinking_mode_entry_id.lock().unwrap() = Some(id);
    
    Ok(id)
}

/// Stop manual entry
#[tauri::command]
pub fn stop_manual_entry(state: State<'_, AppState>) -> Result<ManualEntry, String> {
    let entry_id = state.thinking_mode_entry_id.lock().unwrap().take()
        .ok_or_else(|| "No active manual entry".to_string())?;
    
    let now = Utc::now().timestamp();
    
    // Get the entry to find its start time
    let entries = state
        .db
        .get_manual_entries(now - 86400, now + 86400)
        .map_err(|e| e.to_string())?;
    
    let entry = entries
        .into_iter()
        .find(|e| e.id == entry_id)
        .ok_or_else(|| "Entry not found".to_string())?;
    
    // Update with end time
    state
        .db
        .update_manual_entry(
            entry_id,
            entry.description.as_deref(),
            entry.category_id,
            entry.project.as_deref(),
            entry.project_id,
            entry.task_id,
            entry.started_at,
            now,
        )
        .map_err(|e| e.to_string())?;
    
    let updated_entries = state
        .db
        .get_manual_entries(now - 86400, now + 86400)
        .map_err(|e| e.to_string())?;
    
    updated_entries
        .into_iter()
        .find(|e| e.id == entry_id)
        .ok_or_else(|| "Failed to retrieve updated entry".to_string())
}

/// Get all settings
#[derive(Serialize, Deserialize)]
pub struct SettingsResponse {
    pub idle_threshold_minutes: i64,
    pub idle_prompt_threshold_minutes: i64,
    pub autostart: bool,
    pub minimize_to_tray: bool,
    pub show_notifications: bool,
    pub date_format: String,
    pub time_format: String,
    // Optional: exact seconds for precision (if not provided, calculated from minutes)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub idle_threshold_seconds: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub idle_prompt_threshold_seconds: Option<i64>,
    // Pomodoro settings
    pub pomodoro_work_duration_minutes: i64,
    pub pomodoro_short_break_minutes: i64,
    pub pomodoro_long_break_minutes: i64,
    pub pomodoro_sessions_until_long_break: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pomodoro_auto_transition_delay_seconds: Option<i64>,
    // Optional: exact seconds for precision
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pomodoro_work_duration_seconds: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pomodoro_short_break_seconds: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pomodoro_long_break_seconds: Option<i64>,
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<SettingsResponse, String> {
    let settings = state.db.get_all_settings().map_err(|e| e.to_string())?;
    
    // Try to read seconds first (new format), fallback to minutes (old format) for migration
    let idle_threshold_secs = settings
        .get("idle_threshold_seconds")
        .and_then(|v| v.parse::<i64>().ok())
        .or_else(|| {
            // Migration: convert old minutes format to seconds
            settings
                .get("idle_threshold_minutes")
                .and_then(|v| v.parse::<i64>().ok())
                .map(|mins| mins * 60)
        })
        .unwrap_or(120); // Default: 2 minutes = 120 seconds
    
    let idle_prompt_threshold_secs = settings
        .get("idle_prompt_threshold_seconds")
        .and_then(|v| v.parse::<i64>().ok())
        .or_else(|| {
            // Migration: convert old minutes format to seconds
            settings
                .get("idle_prompt_threshold_minutes")
                .and_then(|v| v.parse::<i64>().ok())
                .map(|mins| mins * 60)
        })
        .unwrap_or(300); // Default: 5 minutes = 300 seconds
    
    // Pomodoro settings - read seconds first, fallback to minutes, then default
    let pomodoro_work_secs = settings
        .get("pomodoro_work_duration_seconds")
        .and_then(|v| v.parse::<i64>().ok())
        .or_else(|| {
            settings
                .get("pomodoro_work_duration_minutes")
                .and_then(|v| v.parse::<i64>().ok())
                .map(|mins| mins * 60)
        })
        .unwrap_or(1500); // Default: 25 minutes = 1500 seconds
    
    let pomodoro_short_break_secs = settings
        .get("pomodoro_short_break_seconds")
        .and_then(|v| v.parse::<i64>().ok())
        .or_else(|| {
            settings
                .get("pomodoro_short_break_minutes")
                .and_then(|v| v.parse::<i64>().ok())
                .map(|mins| mins * 60)
        })
        .unwrap_or(300); // Default: 5 minutes = 300 seconds
    
    let pomodoro_long_break_secs = settings
        .get("pomodoro_long_break_seconds")
        .and_then(|v| v.parse::<i64>().ok())
        .or_else(|| {
            settings
                .get("pomodoro_long_break_minutes")
                .and_then(|v| v.parse::<i64>().ok())
                .map(|mins| mins * 60)
        })
        .unwrap_or(900); // Default: 15 minutes = 900 seconds
    
    let pomodoro_sessions_until_long_break = settings
        .get("pomodoro_sessions_until_long_break")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(4); // Default: 4 sessions
    
    let pomodoro_auto_transition_delay_secs = settings
        .get("pomodoro_auto_transition_delay_seconds")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(15); // Default: 15 seconds
    
    // Convert seconds to minutes for backward compatibility with frontend
    // Also include exact seconds for precision
    Ok(SettingsResponse {
        idle_threshold_minutes: idle_threshold_secs / 60,
        idle_prompt_threshold_minutes: idle_prompt_threshold_secs / 60,
        idle_threshold_seconds: Some(idle_threshold_secs),
        idle_prompt_threshold_seconds: Some(idle_prompt_threshold_secs),
        autostart: settings
            .get("autostart")
            .map(|v| v == "true")
            .unwrap_or(false),
        minimize_to_tray: settings
            .get("minimize_to_tray")
            .map(|v| v == "true")
            .unwrap_or(false),
        show_notifications: settings
            .get("show_notifications")
            .map(|v| v == "true")
            .unwrap_or(true),
        date_format: settings
            .get("date_format")
            .cloned()
            .unwrap_or_else(|| "YYYY-MM-DD".to_string()),
        time_format: settings
            .get("time_format")
            .cloned()
            .unwrap_or_else(|| "24h".to_string()),
        pomodoro_work_duration_minutes: pomodoro_work_secs / 60,
        pomodoro_short_break_minutes: pomodoro_short_break_secs / 60,
        pomodoro_long_break_minutes: pomodoro_long_break_secs / 60,
        pomodoro_sessions_until_long_break,
        pomodoro_auto_transition_delay_seconds: Some(pomodoro_auto_transition_delay_secs),
        pomodoro_work_duration_seconds: Some(pomodoro_work_secs),
        pomodoro_short_break_seconds: Some(pomodoro_short_break_secs),
        pomodoro_long_break_seconds: Some(pomodoro_long_break_secs),
    })
}

/// Update settings
#[tauri::command]
pub fn update_settings(
    _app: tauri::AppHandle,
    state: State<'_, AppState>,
    settings: SettingsResponse,
) -> Result<(), String> {
    // Get current autostart setting to detect changes
    let current_autostart = state.db.get_setting("autostart")
        .map(|v| v.map(|s| s == "true").unwrap_or(false))
        .unwrap_or(false);
    
    // Use exact seconds if provided, otherwise convert from minutes
    let idle_threshold_secs = settings.idle_threshold_seconds.unwrap_or(settings.idle_threshold_minutes * 60);
    let idle_prompt_threshold_secs = settings.idle_prompt_threshold_seconds.unwrap_or(settings.idle_prompt_threshold_minutes * 60);
    
    // Pomodoro settings - use exact seconds if provided, otherwise convert from minutes
    let pomodoro_work_secs = settings.pomodoro_work_duration_seconds.unwrap_or(settings.pomodoro_work_duration_minutes * 60);
    let pomodoro_short_break_secs = settings.pomodoro_short_break_seconds.unwrap_or(settings.pomodoro_short_break_minutes * 60);
    let pomodoro_long_break_secs = settings.pomodoro_long_break_seconds.unwrap_or(settings.pomodoro_long_break_minutes * 60);
    
    // Validate minimum values (at least 1 minute = 60 seconds)
    let pomodoro_work_secs = pomodoro_work_secs.max(60);
    let pomodoro_short_break_secs = pomodoro_short_break_secs.max(60);
    let pomodoro_long_break_secs = pomodoro_long_break_secs.max(60);
    let pomodoro_sessions_until_long_break = settings.pomodoro_sessions_until_long_break.max(1);
    let pomodoro_auto_transition_delay_secs = settings.pomodoro_auto_transition_delay_seconds.unwrap_or(30).max(0).min(300);
    
    let mut settings_map = std::collections::HashMap::new();
    // Store in seconds for precision, but also keep minutes for backward compatibility
    settings_map.insert("idle_threshold_seconds".to_string(), idle_threshold_secs.to_string());
    settings_map.insert("idle_prompt_threshold_seconds".to_string(), idle_prompt_threshold_secs.to_string());
    settings_map.insert("idle_threshold_minutes".to_string(), (idle_threshold_secs / 60).to_string());
    settings_map.insert("idle_prompt_threshold_minutes".to_string(), (idle_prompt_threshold_secs / 60).to_string());
    settings_map.insert("autostart".to_string(), settings.autostart.to_string());
    settings_map.insert("minimize_to_tray".to_string(), settings.minimize_to_tray.to_string());
    settings_map.insert("show_notifications".to_string(), settings.show_notifications.to_string());
    settings_map.insert("date_format".to_string(), settings.date_format);
    settings_map.insert("time_format".to_string(), settings.time_format);
    // Pomodoro settings
    settings_map.insert("pomodoro_work_duration_seconds".to_string(), pomodoro_work_secs.to_string());
    settings_map.insert("pomodoro_short_break_seconds".to_string(), pomodoro_short_break_secs.to_string());
    settings_map.insert("pomodoro_long_break_seconds".to_string(), pomodoro_long_break_secs.to_string());
    settings_map.insert("pomodoro_work_duration_minutes".to_string(), (pomodoro_work_secs / 60).to_string());
    settings_map.insert("pomodoro_short_break_minutes".to_string(), (pomodoro_short_break_secs / 60).to_string());
    settings_map.insert("pomodoro_long_break_minutes".to_string(), (pomodoro_long_break_secs / 60).to_string());
    settings_map.insert("pomodoro_sessions_until_long_break".to_string(), pomodoro_sessions_until_long_break.to_string());
    settings_map.insert("pomodoro_auto_transition_delay_seconds".to_string(), pomodoro_auto_transition_delay_secs.to_string());
    
    // Save settings to database
    state.db.set_settings(&settings_map).map_err(|e| e.to_string())?;
    
    // Apply settings to tracker if it's running
    if let Some(tracker) = state.tracker.lock().unwrap().as_ref() {
        tracker.set_idle_threshold(idle_threshold_secs as u64);
        tracker.set_prompt_threshold(idle_prompt_threshold_secs as u64);
    }
    
    // Update autostart if it changed
    if current_autostart != settings.autostart {
        let app_name = "Time Tracker".to_string();
        let app_path = std::env::current_exe().map_err(|e| format!("Failed to get app path: {}", e))?;
        
        let autostart_manager = crate::autostart::AutostartManager::new(app_name, app_path);
        
        if settings.autostart {
            autostart_manager.enable().map_err(|e| format!("Failed to enable autostart: {}", e))?;
        } else {
            autostart_manager.disable().map_err(|e| format!("Failed to disable autostart: {}", e))?;
        }
    }
    
    Ok(())
}

/// Get daily stats
#[tauri::command]
pub fn get_daily_stats(
    state: State<'_, AppState>,
    date: i64,
) -> Result<serde_json::Value, String> {
    let stats = state.db.get_daily_stats(date).map_err(|e| e.to_string())?;
    
    // Convert to JSON-serializable format
    Ok(serde_json::json!({
        "total_duration_sec": stats.total_seconds,
        "productive_duration_sec": stats.productive_seconds,
        "categories": stats.category_stats.iter().map(|cs| serde_json::json!({
            "category": cs.category.as_ref().map(|c| serde_json::json!({
                "id": c.id,
                "name": c.name,
                "color": c.color,
                "icon": c.icon,
                "is_productive": c.is_productive,
                "sort_order": c.sort_order,
            })),
            "duration_sec": cs.duration_sec,
            "percentage": cs.percentage,
        })).collect::<Vec<_>>(),
        "top_apps": stats.app_stats.iter().map(|as_| serde_json::json!({
            "app_name": as_.app_name,
            "duration_sec": as_.duration_sec,
            "category": as_.category.as_ref().map(|c| serde_json::json!({
                "id": c.id,
                "name": c.name,
                "color": c.color,
                "icon": c.icon,
                "is_productive": c.is_productive,
                "sort_order": c.sort_order,
            })),
        })).collect::<Vec<_>>(),
    }))
}

/// Get top apps
#[tauri::command]
pub fn get_top_apps(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
    limit: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let apps = state.db.get_top_apps(start, end, limit).map_err(|e| e.to_string())?;
    
    Ok(apps.iter().map(|app| serde_json::json!({
        "app_name": app.app_name,
        "duration_sec": app.duration_sec,
        "category": app.category.as_ref().map(|c| serde_json::json!({
            "id": c.id,
            "name": c.name,
            "color": c.color,
            "icon": c.icon,
            "is_productive": c.is_productive,
            "sort_order": c.sort_order,
        })),
    })).collect())
}

/// Get category usage
#[tauri::command]
pub fn get_category_usage(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let usage = state.db.get_category_usage(start, end).map_err(|e| e.to_string())?;
    
    Ok(usage.iter().map(|u| serde_json::json!({
        "category": u.category.as_ref().map(|c| serde_json::json!({
            "id": c.id,
            "name": c.name,
            "color": c.color,
            "icon": c.icon,
            "is_productive": c.is_productive,
            "sort_order": c.sort_order,
        })),
        "duration_sec": u.duration_sec,
        "percentage": u.percentage,
    })).collect())
}

/// Get hourly activity
#[tauri::command]
pub fn get_hourly_activity(
    state: State<'_, AppState>,
    date: i64,
) -> Result<Vec<serde_json::Value>, String> {
    let hourly = state.db.get_hourly_activity(date).map_err(|e| e.to_string())?;
    
    Ok(hourly.iter().map(|h| serde_json::json!({
        "hour": h.hour,
        "duration_sec": h.duration_sec,
    })).collect())
}

/// Get productive time
#[tauri::command]
pub fn get_productive_time(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
) -> Result<i64, String> {
    state.db.get_productive_time(start, end).map_err(|e| e.to_string())
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
    let (is_paused, current_app) = if let Some(tracker) = state.tracker.lock().unwrap().as_ref() {
        let is_paused = tracker.is_paused();
        let current_app = if !is_paused {
            tracker.get_current_app()
        } else {
            None
        };
        (is_paused, current_app)
    } else {
        (false, None)
    };
    
    Ok(serde_json::json!({
        "isTracking": true,
        "isPaused": is_paused,
        "currentApp": current_app,
    }))
}

/// Start thinking mode
#[tauri::command]
pub fn start_thinking_mode(
    state: State<'_, AppState>,
) -> Result<i64, String> {
    // Pause tracking
    if let Some(tracker) = state.tracker.lock().unwrap().as_ref() {
        tracker.pause();
    }
    
    // Find Thinking category
    let thinking_category_id = state
        .db
        .find_category_by_name("Thinking")
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Thinking category not found".to_string())?;
    
    // Start manual entry with Thinking category
    start_manual_entry(state, thinking_category_id, Some("Thinking mode".to_string()))
}

/// Stop thinking mode
#[tauri::command]
pub fn stop_thinking_mode(state: State<'_, AppState>) -> Result<(), String> {
    // Get entry ID before stopping
    let entry_id = state.thinking_mode_entry_id.lock().unwrap().take()
        .ok_or_else(|| "No active manual entry".to_string())?;
    
    let now = Utc::now().timestamp();
    
    // Get the entry to find its start time
    let entries = state
        .db
        .get_manual_entries(now - 86400, now + 86400)
        .map_err(|e| e.to_string())?;
    
    let entry = entries.iter()
        .find(|e| e.id == entry_id)
        .ok_or_else(|| "Entry not found".to_string())?;
    
    // Update with end time
    state
        .db
        .update_manual_entry(
            entry_id,
            entry.description.as_deref(),
            entry.category_id,
            entry.project.as_deref(),
            entry.project_id,
            entry.task_id,
            entry.started_at,
            now,
        )
        .map_err(|e| e.to_string())?;
    
    // Resume tracking
    if let Some(tracker) = state.tracker.lock().unwrap().as_ref() {
        tracker.resume();
    }
    
    Ok(())
}

/// Get idle time
#[tauri::command]
pub fn get_idle_time() -> Result<u64, String> {
    let monitor = crate::idle::IdleMonitor::new();
    Ok(monitor.get_idle_time())
}

/// Check idle state
#[allow(dead_code)]
#[tauri::command]
pub fn check_idle_state(seconds: Option<u64>) -> Result<bool, String> {
    let monitor = crate::idle::IdleMonitor::new();
    Ok(if let Some(secs) = seconds {
        monitor.is_idle_for(secs)
    } else {
        monitor.is_idle()
    })
}

/// Classify idle time
#[tauri::command]
pub fn classify_idle_time(
    state: State<'_, AppState>,
    idle_start: i64,
    idle_end: i64,
    classification: String,
    description: Option<String>,
) -> Result<(), String> {
    // Map classification to category
    let category_id = state
        .db
        .find_category_by_name(&classification)
        .map_err(|e| e.to_string())?;
    
    state
        .db
        .add_manual_entry(
            description.as_deref(),
            category_id,
            idle_start,
            idle_end,
            None, // project_id
            None, // task_id
        )
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Export to CSV
#[tauri::command]
pub fn export_to_csv(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
    file_path: String,
) -> Result<(), String> {
    let activities = state.db.get_activities(start, end).map_err(|e| e.to_string())?;
    let categories = state.db.get_categories().map_err(|e| e.to_string())?;
    
    // Create file and write UTF-8 BOM for Excel compatibility
    use std::fs::File;
    use std::io::Write;
    let mut file = File::create(&file_path)
        .map_err(|e| format!("Failed to create CSV file: {}", e))?;
    
    // Write UTF-8 BOM (0xEF 0xBB 0xBF)
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
        
        // Format timestamp as readable date-time string
        let started_at_dt = Utc.timestamp_opt(activity.started_at, 0)
            .single()
            .ok_or_else(|| format!("Invalid timestamp: {}", activity.started_at))?;
        let started_at_formatted = started_at_dt.format("%Y-%m-%d %H:%M:%S").to_string();
        
        // Format duration as hours:minutes:seconds
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
    let activities = state.db.get_activities(start, end).map_err(|e| e.to_string())?;
    
    let json = serde_json::to_string_pretty(&activities)
        .map_err(|e| format!("Failed to serialize JSON: {}", e))?;
    
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write JSON file: {}", e))?;
    
    Ok(())
}

/// Show main window
#[tauri::command]
pub fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Enable autostart
#[tauri::command]
pub fn enable_autostart(_app: tauri::AppHandle) -> Result<(), String> {
    let app_name = "Time Tracker".to_string();
    let app_path = std::env::current_exe().map_err(|e| format!("Failed to get app path: {}", e))?;
    
    let autostart_manager = crate::autostart::AutostartManager::new(app_name, app_path);
    autostart_manager.enable()
}

/// Disable autostart
#[tauri::command]
pub fn disable_autostart(_app: tauri::AppHandle) -> Result<(), String> {
    let app_name = "Time Tracker".to_string();
    let app_path = std::env::current_exe().map_err(|e| format!("Failed to get app path: {}", e))?;
    
    let autostart_manager = crate::autostart::AutostartManager::new(app_name, app_path);
    autostart_manager.disable()
}

/// Check if autostart is enabled
#[tauri::command]
pub fn is_autostart_enabled(_app: tauri::AppHandle) -> Result<bool, String> {
    let app_name = "Time Tracker".to_string();
    let app_path = std::env::current_exe().map_err(|e| format!("Failed to get app path: {}", e))?;
    
    let autostart_manager = crate::autostart::AutostartManager::new(app_name, app_path);
    autostart_manager.is_enabled()
}

/// Hide main window
#[tauri::command]
pub fn hide_main_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Show idle prompt (already handled by event, but keeping for API compatibility)
#[tauri::command]
pub fn show_idle_prompt(
    app: tauri::AppHandle,
    idle_duration: u64,
    _idle_start: i64,
) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_window("main") {
        window
            .emit("idle-return", serde_json::json!({ "duration_minutes": idle_duration / 60 }))
            .map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ========== PROJECT COMMANDS ==========

/// Create a project
#[tauri::command]
pub fn create_project(
    state: State<'_, AppState>,
    name: String,
    client_name: Option<String>,
    color: String,
    is_billable: bool,
    hourly_rate: f64,
    budget_hours: Option<f64>,
) -> Result<Project, String> {
    let id = state
        .db
        .create_project(&name, client_name.as_deref(), &color, is_billable, hourly_rate, budget_hours)
        .map_err(|e| e.to_string())?;
    
    state
        .db
        .get_project_by_id(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to retrieve created project".to_string())
}

/// Get all projects
#[tauri::command]
pub fn get_projects(
    state: State<'_, AppState>,
    include_archived: bool,
) -> Result<Vec<Project>, String> {
    state
        .db
        .get_projects(include_archived)
        .map_err(|e| e.to_string())
}

/// Update a project
#[tauri::command]
pub fn update_project(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    client_name: Option<String>,
    color: String,
    is_billable: bool,
    hourly_rate: f64,
    budget_hours: Option<f64>,
    is_archived: Option<bool>,
) -> Result<Project, String> {
    state
        .db
        .update_project(id, &name, client_name.as_deref(), &color, is_billable, hourly_rate, budget_hours, is_archived)
        .map_err(|e| e.to_string())?;
    
    state
        .db
        .get_project_by_id(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Project not found".to_string())
}

/// Delete a project (archive)
#[tauri::command]
pub fn delete_project(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.delete_project(id).map_err(|e| e.to_string())
}

// ========== TASK COMMANDS ==========

/// Create a task
#[tauri::command]
pub fn create_task(
    state: State<'_, AppState>,
    project_id: i64,
    name: String,
    description: Option<String>,
) -> Result<Task, String> {
    let id = state
        .db
        .create_task(project_id, &name, description.as_deref())
        .map_err(|e| e.to_string())?;
    
    state
        .db
        .get_task_by_id(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Failed to retrieve created task".to_string())
}

/// Get tasks
#[tauri::command]
pub fn get_tasks(
    state: State<'_, AppState>,
    project_id: Option<i64>,
    include_archived: bool,
) -> Result<Vec<Task>, String> {
    state
        .db
        .get_tasks(project_id, include_archived)
        .map_err(|e| e.to_string())
}

/// Update a task
#[tauri::command]
pub fn update_task(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    description: Option<String>,
    archived: Option<bool>,
) -> Result<Task, String> {
    state
        .db
        .update_task(id, &name, description.as_deref(), archived)
        .map_err(|e| e.to_string())?;
    
    state
        .db
        .get_task_by_id(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Task not found".to_string())
}

/// Delete a task (archive)
#[tauri::command]
pub fn delete_task(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.delete_task(id).map_err(|e| e.to_string())
}

// ========== BILLABLE TIME COMMANDS ==========

/// Get billable hours for a time range
#[tauri::command]
pub fn get_billable_hours(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
) -> Result<i64, String> {
    state
        .db
        .get_billable_hours(start, end)
        .map_err(|e| e.to_string())
}

/// Get billable revenue for a time range
#[tauri::command]
pub fn get_billable_revenue(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
) -> Result<f64, String> {
    state
        .db
        .get_billable_revenue(start, end)
        .map_err(|e| e.to_string())
}

// ========== DOMAIN COMMANDS ==========

/// Get top domains for a time range
#[tauri::command]
pub fn get_top_domains(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
    limit: i64,
) -> Result<Vec<DomainStat>, String> {
    state
        .db
        .get_top_domains(start, end, limit)
        .map_err(|e| e.to_string())
}

// ========== POMODORO COMMANDS ==========

/// Start Pomodoro timer
#[tauri::command]
pub fn start_pomodoro(
    state: State<'_, AppState>,
    pomodoro_type: String,
    project_id: Option<i64>,
    task_id: Option<i64>,
) -> Result<i64, String> {
    // Set active project/task for automatic tracking
    *state.active_project_id.lock().unwrap() = project_id;
    *state.active_task_id.lock().unwrap() = task_id;
    
    // Create Pomodoro session
    state
        .db
        .create_focus_session(&pomodoro_type, project_id, task_id)
        .map_err(|e| e.to_string())
}

/// Stop Pomodoro timer
#[tauri::command]
pub fn stop_pomodoro(
    state: State<'_, AppState>,
    session_id: i64,
    duration_sec: i64,
    completed: bool,
) -> Result<(), String> {
    state
        .db
        .update_focus_session(session_id, duration_sec, completed)
        .map_err(|e| e.to_string())
}

/// Get focus sessions for a time range
#[tauri::command]
pub fn get_focus_sessions(
    state: State<'_, AppState>,
    start: i64,
    end: i64,
) -> Result<Vec<FocusSession>, String> {
    state
        .db
        .get_focus_sessions(start, end)
        .map_err(|e| e.to_string())
}

/// Get count of completed work sessions for today
#[tauri::command]
pub fn get_completed_work_sessions_count_today(
    state: State<'_, AppState>
) -> Result<i32, String> {
    state
        .db
        .get_completed_work_sessions_count_today()
        .map_err(|e| e.to_string())
}

/// Get active (not ended) pomodoro session
#[tauri::command]
pub fn get_active_pomodoro_session(
    state: State<'_, AppState>
) -> Result<Option<FocusSession>, String> {
    state
        .db
        .get_active_focus_session()
        .map_err(|e| e.to_string())
}

/// Delete focus session
#[tauri::command]
pub fn delete_focus_session(
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), String> {
    state.db.delete_focus_session(id).map_err(|e| e.to_string())
}

// ========== ACTIVE PROJECT/TASK COMMANDS ==========

/// Set active project for automatic tracking
#[tauri::command]
pub fn set_active_project(
    state: State<'_, AppState>,
    project_id: Option<i64>,
) -> Result<(), String> {
    *state.active_project_id.lock().unwrap() = project_id;
    // If project is cleared, clear task as well
    if project_id.is_none() {
        *state.active_task_id.lock().unwrap() = None;
    }
    Ok(())
}

/// Set active task for automatic tracking
#[tauri::command]
pub fn set_active_task(
    state: State<'_, AppState>,
    task_id: Option<i64>,
) -> Result<(), String> {
    *state.active_task_id.lock().unwrap() = task_id;
    Ok(())
}

/// Get active project ID
#[tauri::command]
pub fn get_active_project(state: State<'_, AppState>) -> Result<Option<i64>, String> {
    Ok(*state.active_project_id.lock().unwrap())
}

/// Get active task ID
#[tauri::command]
pub fn get_active_task(state: State<'_, AppState>) -> Result<Option<i64>, String> {
    Ok(*state.active_task_id.lock().unwrap())
}

// ========== GOAL COMMANDS ==========

/// Create a goal
#[tauri::command]
pub fn create_goal(
    state: State<'_, AppState>,
    goal_type: String,
    target_seconds: i64,
    category_id: Option<i64>,
    project_id: Option<i64>,
    start_date: i64,
    end_date: Option<i64>,
    name: Option<String>,
) -> Result<i64, String> {
    state
        .db
        .create_goal(&goal_type, target_seconds, category_id, project_id, start_date, end_date, name.as_deref())
        .map_err(|e| e.to_string())
}

/// Get goals
#[tauri::command]
pub fn get_goals(
    state: State<'_, AppState>,
    active_only: bool,
) -> Result<Vec<Goal>, String> {
    state
        .db
        .get_goals(active_only)
        .map_err(|e| e.to_string())
}

/// Update a goal
#[tauri::command]
pub fn update_goal(
    state: State<'_, AppState>,
    id: i64,
    goal_type: String,
    target_seconds: i64,
    category_id: Option<i64>,
    project_id: Option<i64>,
    start_date: i64,
    end_date: Option<i64>,
    active: bool,
    name: Option<String>,
) -> Result<(), String> {
    state
        .db
        .update_goal(id, &goal_type, target_seconds, category_id, project_id, start_date, end_date, active, name.as_deref())
        .map_err(|e| e.to_string())
}

/// Delete a goal
#[tauri::command]
pub fn delete_goal(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.db.delete_goal(id).map_err(|e| e.to_string())
}

/// Get goal progress
#[tauri::command]
pub fn get_goal_progress(
    state: State<'_, AppState>,
    goal_id: i64,
    start: i64,
    end: i64,
) -> Result<GoalProgress, String> {
    state
        .db
        .get_goal_progress(goal_id, start, end)
        .map_err(|e| e.to_string())
}

/// Check goal alerts
#[tauri::command]
pub fn check_goal_alerts(
    state: State<'_, AppState>,
) -> Result<Vec<GoalAlert>, String> {
    state
        .db
        .check_goal_alerts()
        .map_err(|e| e.to_string())
}
