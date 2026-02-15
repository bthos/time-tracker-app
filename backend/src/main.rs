// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod autostart;
mod commands;
mod database;
mod idle;
mod plugin_system;
mod tracker;
mod tray;
mod window;

use commands::AppState;
use database::Database;
use plugin_system::{PluginRegistry, ExtensionRegistry};
use plugin_system::loader::PluginLoader;
use std::sync::{Arc, Mutex};
use tauri::Manager;

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

    // Create app state
    let plugin_loader_arc = Arc::new(plugin_loader);
    let app_state = AppState {
        db: Arc::clone(&db),
        tracker: Arc::new(Mutex::new(None)),
        thinking_mode_entry_id: Arc::new(Mutex::new(None)),
        plugin_registry: Some(Arc::clone(&plugin_registry)),
        extension_registry: Some(Arc::clone(&extension_registry)),
        plugin_loader: Some(Arc::clone(&plugin_loader_arc)),
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
            // Domain commands
            commands::get_top_domains,
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
            commands::unload_plugin,
            commands::invoke_plugin_command,
            commands::is_plugin_installed,
            commands::get_plugin,
            commands::get_plugin_ids,
            commands::is_plugin_loaded,
            commands::get_plugins_directory,
            commands::check_plugin_installed,
            commands::get_plugin_manifest_path,
        ])
        .setup(move |app| {
            let app_handle = app.handle();
            let db_clone = Arc::clone(&db);

            // Start the tracker in a background thread (extension_registry for plugin data hooks)
            let extension_registry_for_tracker = app.state::<commands::AppState>().extension_registry.clone();
            let tracker = Arc::new(tracker::Tracker::new(Arc::clone(&db_clone), extension_registry_for_tracker));
            
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
            
            // Clone app handle for the closure (needed because it's also used for tray)
            let app_handle_for_tracker = app_handle.clone();
            
            tracker.start(move |idle_minutes, started_at| {
                // Emit idle-return event to frontend
                if let Some(window) = app_handle_for_tracker.get_window("main") {
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

            // Load plugins asynchronously in background thread (non-blocking)
            let app_state = app.state::<commands::AppState>();
            if let (Some(plugin_registry), Some(extension_registry), Some(plugin_loader)) = (
                app_state.plugin_registry.as_ref(),
                app_state.extension_registry.as_ref(),
                app_state.plugin_loader.as_ref(),
            ) {
                let db_for_plugins = Arc::clone(&app_state.db);
                let plugin_registry_for_loading = Arc::clone(plugin_registry);
                let extension_registry_for_loading = Arc::clone(extension_registry);
                let plugin_loader_for_loading = Arc::clone(plugin_loader);

                std::thread::spawn(move || {
                    eprintln!("Starting async plugin loading...");

                    // Load and initialize all installed plugins dynamically
                    match plugin_loader_for_loading.load_all_installed_plugins(&db_for_plugins) {
                        Ok(dynamic_plugins) => {
                            use plugin_system::api::PluginAPI;
                            use time_tracker_plugin_sdk::PluginAPIInterface;

                            // First pass: Load manifests and register exposed tables
                            let installed_plugins = db_for_plugins.get_installed_plugins()
                                .unwrap_or_default();
                            
                            for (plugin_id, _name, _version, _description, _repo_url, manifest_path, _frontend_entry, _frontend_components, _author, enabled) in installed_plugins {
                                if !enabled {
                                    continue;
                                }
                                
                                if let Some(manifest_path_str) = manifest_path {
                                    let manifest_path_buf = std::path::PathBuf::from(manifest_path_str);
                                    if let Ok(manifest) = plugin_loader_for_loading.load_manifest(&manifest_path_buf) {
                                        if let Some(ref exposed_tables) = manifest.plugin.exposed_tables {
                                            if let Err(e) = extension_registry_for_loading.register_exposed_tables(&plugin_id, exposed_tables) {
                                                eprintln!("Warning: Failed to register exposed tables for plugin {}: {}", plugin_id, e);
                                            }
                                        }
                                    }
                                }
                            }

                            // Second pass: Initialize plugins
                            for (plugin_id, mut plugin) in dynamic_plugins {
                                let api = PluginAPI::new(
                                    Arc::clone(&db_for_plugins),
                                    Arc::clone(&extension_registry_for_loading),
                                    plugin_id.clone(),
                                );
                                match plugin.initialize(&api as &dyn PluginAPIInterface) {
                                    Ok(()) => {
                                        if let Err(e) =
                                            plugin_registry_for_loading.register(plugin)
                                        {
                                            eprintln!(
                                                "Warning: Failed to register dynamic plugin {}: {}",
                                                plugin_id, e
                                            );
                                        } else {
                                            eprintln!(
                                                "Initialized and registered dynamic plugin: {}",
                                                plugin_id
                                            );
                                        }
                                    }
                                    Err(e) => {
                                        eprintln!(
                                            "Warning: Failed to initialize dynamic plugin {}: {}",
                                            plugin_id, e
                                        );
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("Warning: Failed to load dynamic plugins: {}", e);
                        }
                    }

                    // Apply plugin extensions to database schema
                    if let Err(e) = db_for_plugins
                        .apply_plugin_extensions(&extension_registry_for_loading)
                    {
                        eprintln!("Warning: Failed to apply plugin extensions: {}", e);
                    }

                    eprintln!("Plugin loading completed");
                });
            }

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
