// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod autostart;
mod commands;
mod database;
mod idle;
mod plugins;
mod pomodoro;
mod plugin_system;
mod tracker;
mod tray;
mod window;

use commands::AppState;
use database::Database;
use plugin_system::{PluginRegistry, ExtensionRegistry, Plugin};
use plugin_system::loader::PluginLoader;
use plugins::{ProjectsTasksPlugin, BillingPlugin, PomodoroPlugin, GoalsPlugin};
use std::sync::{Arc, Mutex};
use tauri::Manager;

/// Install built-in plugins if they're not already installed
fn install_builtin_plugins(
    db: &Arc<Database>,
    _plugin_registry: &Arc<PluginRegistry>,
    _extension_registry: &Arc<ExtensionRegistry>,
) -> Result<(), String> {
    let builtin_plugins = vec![
        ("projects-tasks-plugin", "Projects/Tasks", "1.0.0", "Project and task management"),
        ("billing-plugin", "Billing", "1.0.0", "Billable time tracking"),
        ("pomodoro-plugin", "Pomodoro", "1.0.0", "Pomodoro timer"),
        ("goals-plugin", "Goals", "1.0.0", "Goal tracking"),
    ];
    
    for (plugin_id, name, version, description) in builtin_plugins {
        match db.is_plugin_installed(plugin_id) {
            Ok(false) => {
                db.install_plugin(plugin_id, name, version, Some(description), true)?;
                eprintln!("Installed built-in plugin: {}", plugin_id);
            }
            Ok(true) => {
                // Plugin already installed
            }
            Err(e) => {
                eprintln!("Warning: Failed to check if plugin {} is installed: {}", plugin_id, e);
            }
        }
    }
    
    Ok(())
}

/// Load and initialize built-in plugins
fn load_builtin_plugins(
    db: &Arc<Database>,
    plugin_registry: &Arc<PluginRegistry>,
    extension_registry: &Arc<ExtensionRegistry>,
) -> Result<(), String> {
    use plugin_system::api::PluginAPI;
    
    use time_tracker_plugin_sdk::PluginAPIInterface;
    
    // Load Projects/Tasks Plugin
    if db.is_plugin_installed("projects-tasks-plugin")? {
        let mut plugin = ProjectsTasksPlugin::new(Arc::clone(db));
        let api = PluginAPI::new(Arc::clone(db), Arc::clone(extension_registry), "projects-tasks-plugin".to_string());
        plugin.initialize(&api as &dyn PluginAPIInterface)?;
        plugin_registry.register(Box::new(plugin))?;
        eprintln!("Loaded plugin: projects-tasks-plugin");
    }
    
    // Load Billing Plugin
    if db.is_plugin_installed("billing-plugin")? {
        let mut plugin = BillingPlugin::new(Arc::clone(db));
        let api = PluginAPI::new(Arc::clone(db), Arc::clone(extension_registry), "billing-plugin".to_string());
        plugin.initialize(&api as &dyn PluginAPIInterface)?;
        plugin_registry.register(Box::new(plugin))?;
        eprintln!("Loaded plugin: billing-plugin");
    }
    
    // Load Pomodoro Plugin
    if db.is_plugin_installed("pomodoro-plugin")? {
        let mut plugin = PomodoroPlugin::new(Arc::clone(db));
        let api = PluginAPI::new(Arc::clone(db), Arc::clone(extension_registry), "pomodoro-plugin".to_string());
        plugin.initialize(&api as &dyn PluginAPIInterface)?;
        plugin_registry.register(Box::new(plugin))?;
        eprintln!("Loaded plugin: pomodoro-plugin");
    }
    
    // Load Goals Plugin
    if db.is_plugin_installed("goals-plugin")? {
        let mut plugin = GoalsPlugin::new(Arc::clone(db));
        let api = PluginAPI::new(Arc::clone(db), Arc::clone(extension_registry), "goals-plugin".to_string());
        plugin.initialize(&api as &dyn PluginAPIInterface)?;
        plugin_registry.register(Box::new(plugin))?;
        eprintln!("Loaded plugin: goals-plugin");
    }
    
    Ok(())
}

fn main() {
    // Get data directory
    let data_dir = dirs::data_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("timetracker");

    // Initialize database
    let db_path = data_dir.join("data.db");
    let db = Arc::new(
        Database::new(db_path).expect("Failed to initialize database"),
    );

    // Initialize plugin system
    let extension_registry = Arc::new(ExtensionRegistry::new());
    let plugin_registry = Arc::new(PluginRegistry::new(Arc::clone(&db)));
    
    // Get plugins directory
    let plugins_dir = data_dir.join("plugins");
    let plugin_loader = PluginLoader::new(plugins_dir);
    
    // Install built-in plugins if not already installed
    if let Err(e) = install_builtin_plugins(&db, &plugin_registry, &extension_registry) {
        eprintln!("Warning: Failed to install built-in plugins: {}", e);
    }
    
    // Load and initialize built-in plugins (statically compiled)
    if let Err(e) = load_builtin_plugins(&db, &plugin_registry, &extension_registry) {
        eprintln!("Warning: Failed to load built-in plugins: {}", e);
    }
    
    // Load and initialize dynamically installed plugins
    match plugin_loader.load_all_installed_plugins(&db) {
        Ok(dynamic_plugins) => {
            use plugin_system::api::PluginAPI;
            use time_tracker_plugin_sdk::PluginAPIInterface;
            
            for (plugin_id, mut plugin) in dynamic_plugins {
                let api = PluginAPI::new(Arc::clone(&db), Arc::clone(&extension_registry), plugin_id.clone());
                match plugin.initialize(&api as &dyn PluginAPIInterface) {
                    Ok(()) => {
                        if let Err(e) = plugin_registry.register(plugin) {
                            eprintln!("Warning: Failed to register dynamic plugin {}: {}", plugin_id, e);
                        } else {
                            eprintln!("Initialized and registered dynamic plugin: {}", plugin_id);
                        }
                    }
                    Err(e) => {
                        eprintln!("Warning: Failed to initialize dynamic plugin {}: {}", plugin_id, e);
                    }
                }
            }
        }
        Err(e) => {
            eprintln!("Warning: Failed to load dynamic plugins: {}", e);
        }
    }
    
    // Apply plugin extensions to database schema
    if let Err(e) = db.apply_plugin_extensions(&extension_registry) {
        eprintln!("Warning: Failed to apply plugin extensions: {}", e);
    }

    // Create app state
    let app_state = AppState {
        db: Arc::clone(&db),
        tracker: Arc::new(Mutex::new(None)),
        thinking_mode_entry_id: Arc::new(Mutex::new(None)),
        active_project_id: Arc::new(Mutex::new(None)),
        active_task_id: Arc::new(Mutex::new(None)),
        plugin_registry: Some(Arc::clone(&plugin_registry)),
    };

    // Build Tauri application
    tauri::Builder::default()
        .manage(app_state)
        .system_tray(tray::create_tray())
        .on_system_tray_event(|app, event| {
            tray::handle_tray_event(app, event);
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event.event() {
                // Check if minimize to tray is enabled
                if let Some(state) = event.window().app_handle().try_state::<commands::AppState>() {
                    if let Ok(Some(minimize_to_tray)) = state.db.get_setting("minimize_to_tray")
                        .map(|v: Option<String>| v.map(|s: String| s == "true"))
                    {
                        if minimize_to_tray {
                            // Hide window instead of closing
                            event.window().hide().ok();
                            api.prevent_close();
                            return;
                        }
                    }
                    
                    // Stop tracker before closing
                    if let Ok(Some(tracker)) = state.tracker.lock().map(|t| t.clone()) {
                        tracker.stop();
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_activities,
            commands::get_activity,
            commands::update_activity_category,
            commands::delete_activity,
            commands::reapply_categorization_rules,
            commands::get_categories,
            commands::create_category,
            commands::update_category,
            commands::delete_category,
            commands::reset_system_category,
            commands::get_rules,
            commands::add_rule,
            commands::create_rule,
            commands::update_rule,
            commands::delete_rule,
            commands::add_manual_entry,
            commands::create_manual_entry,
            commands::update_manual_entry,
            commands::delete_manual_entry,
            commands::get_manual_entries,
            commands::start_manual_entry,
            commands::stop_manual_entry,
            commands::submit_idle_activity,
            commands::get_today_total,
            commands::get_setting,
            commands::set_setting,
            commands::get_settings,
            commands::update_settings,
            commands::enable_autostart,
            commands::disable_autostart,
            commands::is_autostart_enabled,
            commands::get_stats,
            commands::get_daily_stats,
            commands::get_top_apps,
            commands::get_category_usage,
            commands::get_hourly_activity,
            commands::get_productive_time,
            commands::pause_tracking,
            commands::resume_tracking,
            commands::get_tracking_status,
            commands::start_thinking_mode,
            commands::stop_thinking_mode,
            commands::get_idle_time,
            commands::check_idle_state,
            commands::classify_idle_time,
            commands::export_to_csv,
            commands::export_to_json,
            commands::show_main_window,
            commands::hide_main_window,
            commands::show_idle_prompt,
            // Project commands
            commands::create_project,
            commands::get_projects,
            commands::update_project,
            commands::delete_project,
            // Task commands
            commands::create_task,
            commands::get_tasks,
            commands::update_task,
            commands::delete_task,
            // Billable time commands
            commands::get_billable_hours,
            commands::get_billable_revenue,
            // Domain commands
            commands::get_top_domains,
            // Pomodoro commands
            commands::start_pomodoro,
            commands::stop_pomodoro,
            commands::get_focus_sessions,
            commands::get_completed_work_sessions_count_today,
            commands::get_active_pomodoro_session,
            commands::delete_focus_session,
            // Active project/task commands
            commands::set_active_project,
            commands::set_active_task,
            commands::get_active_project,
            commands::get_active_task,
            // Goal commands
            commands::create_goal,
            commands::get_goals,
            commands::update_goal,
            commands::delete_goal,
            commands::get_goal_progress,
            commands::check_goal_alerts,
            // Plugin commands
            commands::get_plugin_registry,
            commands::search_plugins,
            commands::get_plugin_info,
            commands::discover_plugin,
            commands::install_plugin,
            commands::list_installed_plugins,
            commands::uninstall_plugin,
            commands::enable_plugin,
            commands::disable_plugin,
            commands::load_plugin,
        ])
        .setup(move |app| {
            let app_handle = app.handle();
            let db_clone = Arc::clone(&db);

            // Get active project/task references from app state
            let app_state = app.state::<commands::AppState>();
            let active_project_id = Arc::clone(&app_state.active_project_id);
            let active_task_id = Arc::clone(&app_state.active_task_id);

            // Start the tracker in a background thread
            let tracker = Arc::new(tracker::Tracker::new(
                Arc::clone(&db_clone),
                active_project_id,
                active_task_id,
            ));
            
            // Load settings from database and apply to tracker
            if let Ok(settings) = db_clone.get_all_settings() {
                let idle_threshold_secs = settings
                    .get("idle_threshold_seconds")
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(120);
                let prompt_threshold_secs = settings
                    .get("idle_prompt_threshold_seconds")
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(300);
                
                tracker.set_idle_threshold(idle_threshold_secs);
                tracker.set_prompt_threshold(prompt_threshold_secs);
            }
            
            // Store tracker reference in app state
            if let Ok(mut tracker_ref) = app.state::<commands::AppState>().tracker.lock() {
                *tracker_ref = Some(Arc::clone(&tracker));
            }
            
            // Clone app handle for the closure
            let app_handle_clone = app_handle.clone();
            
            tracker.start(move |idle_minutes, started_at| {
                // Emit idle-return event to frontend
                if let Some(window) = app_handle_clone.get_window("main") {
                    window
                        .emit("idle-return", serde_json::json!({ 
                            "duration_minutes": idle_minutes,
                            "started_at": started_at
                        }))
                        .ok();
                    window.show().ok();
                    window.set_focus().ok();
                }
            });

            // Start tray update timer
            let db_for_tray = Arc::clone(&db_clone);
            let app_handle_for_tray = app_handle.clone();
            
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(60));
                    
                    if let Ok(total) = db_for_tray.get_today_total() {
                        tray::update_tray_time(&app_handle_for_tray, total);
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
