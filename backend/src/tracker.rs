//! Tracker module - Core tracking loop for monitoring active windows

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use crate::database::Database;
use crate::idle::IdleMonitor;
use crate::plugin_system::ExtensionRegistry;
use crate::window::WindowTracker;

/// Extract domain from browser window title
fn extract_domain(app_name: &str, window_title: Option<&str>) -> Option<String> {
    // Only process browser windows
    let browser_apps = ["chrome", "firefox", "edge", "safari", "opera", "brave", "vivaldi"];
    if !browser_apps.iter().any(|&browser| app_name.to_lowercase().contains(browser)) {
        return None;
    }

    let title = window_title?;
    
    // Pattern 1: URL in title like "https://example.com/page - Browser"
    for protocol in ["http://", "https://"] {
        if let Some(url_start) = title.find(protocol) {
            let url_part = &title[url_start..];
            if let Some(url_end) = url_part.find(|c: char| c == ' ' || c == '-' || c == '|') {
                let url = &url_part[..url_end];
                if let Some(domain) = extract_domain_from_url(url) {
                    return Some(domain);
                }
            } else {
                if let Some(domain) = extract_domain_from_url(url_part) {
                    return Some(domain);
                }
            }
        }
    }

    // Pattern 2: "example.com - Page Title" or "Page Title - example.com"
    if let Some(_dash_pos) = title.find(" - ") {
        let parts: Vec<&str> = title.split(" - ").collect();
        for part in parts {
            let trimmed = part.trim();
            if trimmed.contains('.') && !trimmed.starts_with("http") {
                // Check if it looks like a domain
                if trimmed.matches('.').count() >= 1 {
                    let domain = trimmed.split(' ').next().unwrap_or(trimmed);
                    if is_valid_domain(domain) {
                        return Some(domain.to_lowercase());
                    }
                }
            }
        }
    }

    // Pattern 3: Direct domain match in title
    let words: Vec<&str> = title.split_whitespace().collect();
    for word in words {
        if word.contains('.') && !word.starts_with("http") {
            let cleaned = word.trim_matches(|c: char| !c.is_alphanumeric() && c != '.' && c != '-');
            if is_valid_domain(cleaned) {
                return Some(cleaned.to_lowercase());
            }
        }
    }

    None
}

/// Extract domain from URL string
fn extract_domain_from_url(url: &str) -> Option<String> {
    // Remove protocol
    let without_protocol = url
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_start_matches("www.");

    // Extract domain (everything before first / or ?)
    let domain_part = without_protocol
        .split('/')
        .next()?
        .split('?')
        .next()?
        .split('#')
        .next()?;

    if is_valid_domain(domain_part) {
        Some(domain_part.to_lowercase())
    } else {
        None
    }
}

/// Check if string looks like a valid domain
fn is_valid_domain(s: &str) -> bool {
    if s.is_empty() || s.len() > 253 {
        return false;
    }

    // Skip localhost, IP addresses, file:// URLs
    if s.starts_with("localhost") || s.starts_with("127.") || s.starts_with("192.168.") || s.starts_with("file://") {
        return false;
    }

    // Must contain at least one dot
    if !s.contains('.') {
        return false;
    }

    // Basic validation: alphanumeric, dots, hyphens
    s.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '-')
}

/// Tracker service that runs the main tracking loop
pub struct Tracker {
    db: Arc<Database>,
    extension_registry: Option<Arc<ExtensionRegistry>>,
    window_tracker: WindowTracker,
    idle_monitor: Arc<IdleMonitor>,
    running: Arc<AtomicBool>,
    paused: Arc<AtomicBool>,
    idle_threshold_secs: Arc<Mutex<u64>>,
    prompt_threshold_secs: Arc<Mutex<u64>>,
}

impl Tracker {
    /// Create a new tracker instance.
    /// If `extension_registry` is provided, plugin data hooks will be applied after each activity upsert.
    pub fn new(db: Arc<Database>, extension_registry: Option<Arc<ExtensionRegistry>>) -> Self {
        Self {
            db,
            extension_registry,
            window_tracker: WindowTracker::new(),
            idle_monitor: Arc::new(IdleMonitor::new()),
            running: Arc::new(AtomicBool::new(false)),
            paused: Arc::new(AtomicBool::new(false)),
            idle_threshold_secs: Arc::new(Mutex::new(120)), // 2 minutes default
            prompt_threshold_secs: Arc::new(Mutex::new(300)), // 5 minutes default
        }
    }

    /// Set idle threshold in seconds
    pub fn set_idle_threshold(&self, secs: u64) {
        *self.idle_threshold_secs.lock().unwrap() = secs;
    }

    /// Set prompt threshold in seconds
    pub fn set_prompt_threshold(&self, secs: u64) {
        *self.prompt_threshold_secs.lock().unwrap() = secs;
    }

    /// Check if tracker is running
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Pause tracking
    pub fn pause(&self) {
        self.paused.store(true, Ordering::SeqCst);
    }

    /// Resume tracking
    pub fn resume(&self) {
        self.paused.store(false, Ordering::SeqCst);
    }

    /// Check if tracking is paused
    pub fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    /// Get current active app name
    pub fn get_current_app(&self) -> Option<String> {
        if self.paused.load(Ordering::SeqCst) {
            return None;
        }
        self.window_tracker.get_active_window()
            .map(|info| info.app_name)
    }

    /// Stop the tracker
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }

    /// Start the tracking loop
    /// Returns a callback function to trigger idle return prompt
    pub fn start<F>(&self, on_idle_return: F)
    where
        F: Fn(u64, i64) + Send + 'static,
    {
        self.running.store(true, Ordering::SeqCst);

        let running = Arc::clone(&self.running);
        let paused = Arc::clone(&self.paused);
        let db = Arc::clone(&self.db);
        let extension_registry = self.extension_registry.clone();
        let idle_threshold = Arc::clone(&self.idle_threshold_secs);
        let idle_monitor = Arc::clone(&self.idle_monitor);

        thread::spawn(move || {
            let window_tracker = WindowTracker::new();
            
            let mut is_idle_mode = false;
            let mut idle_start_time: Option<i64> = None;

            while running.load(Ordering::SeqCst) {
                // Sleep for 5 seconds between checks
                thread::sleep(Duration::from_secs(5));

                // Skip if paused
                if paused.load(Ordering::SeqCst) {
                    continue;
                }

                let idle_time = idle_monitor.get_idle_time();
                let now = chrono::Utc::now().timestamp();

                // Check for idle state
                let idle_threshold_value = *idle_threshold.lock().unwrap();
                if idle_time > idle_threshold_value {
                    if !is_idle_mode {
                        // Entering idle mode
                        is_idle_mode = true;
                        idle_start_time = Some(now);
                        
                        if let Err(e) = db.record_idle_start(now) {
                            eprintln!("Failed to record idle start: {}", e);
                        }
                    } else if let Some(start) = idle_start_time {
                        // Update idle duration
                        let duration = now - start;
                        if let Err(e) = db.update_idle_duration(start, duration) {
                            eprintln!("Failed to update idle duration: {}", e);
                        }
                    }
                    continue;
                }

                // Exiting idle mode
                if is_idle_mode {
                    is_idle_mode = false;
                    
                    if let Some(start) = idle_start_time {
                        let idle_duration = (now - start) as u64;
                        
                        // Always send idle return event, let frontend decide whether to show prompt
                        // Frontend will filter based on prompt_threshold and user preferences
                        on_idle_return(idle_duration / 60, start); // Convert to minutes, pass started_at
                    }
                    
                    idle_start_time = None;
                }

                // Get active window info
                if let Some(window_info) = window_tracker.get_active_window() {
                    let domain = extract_domain(&window_info.app_name, window_info.title.as_deref());
                    match db.upsert_activity(
                        &window_info.app_name,
                        window_info.title.as_deref(),
                        domain.as_deref(),
                        now,
                    ) {
                        Ok(activity_id) => {
                            // Apply plugin data hooks if extension registry is available
                            if let Some(reg) = &extension_registry {
                                if let Ok(Some(mut activity)) = db.get_activity_by_id(activity_id) {
                                    if let Err(e) = reg.apply_activity_hooks(&mut activity, &db) {
                                        eprintln!("Warning: Failed to apply activity hooks: {}", e);
                                    } else if let Err(e) = db.update_activity_row(&activity) {
                                        eprintln!("Warning: Failed to persist activity after hooks: {}", e);
                                    }
                                }
                            }
                        }
                        Err(e) => eprintln!("Failed to record activity: {}", e),
                    }
                }
            }
        });
    }
}
