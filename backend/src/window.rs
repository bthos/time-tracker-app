//! Window tracking module - Detects the currently active window using native APIs

#[cfg(windows)]
use winapi::um::winuser::{GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId};
#[cfg(windows)]
use winapi::um::processthreadsapi::OpenProcess;
#[cfg(windows)]
use winapi::um::handleapi::CloseHandle;
#[cfg(windows)]
use winapi::um::psapi::GetModuleBaseNameW;
#[cfg(windows)]
use winapi::shared::minwindef::{DWORD, MAX_PATH};
#[cfg(windows)]
use std::ffi::OsString;
#[cfg(windows)]
use std::os::windows::ffi::OsStringExt;

use active_win_pos_rs::get_active_window;

/// Information about the active window
#[derive(Debug, Clone)]
pub struct WindowInfo {
    pub app_name: String,
    pub title: Option<String>,
    #[allow(dead_code)]
    pub process_id: Option<u32>,
}

/// Window tracker for detecting active windows
pub struct WindowTracker;

impl WindowTracker {
    /// Create a new window tracker
    pub fn new() -> Self {
        Self
    }

    /// Get the currently active window using native APIs
    pub fn get_active_window(&self) -> Option<WindowInfo> {
        match get_active_window() {
            Ok(active_window) => {
                #[cfg(windows)]
                {
                    // Use Windows APIs to get window title and process name
                    // Note: active_window is not used on Windows, we use native APIs instead
                    let _ = active_window;
                    unsafe {
                        let hwnd = GetForegroundWindow();
                        if hwnd.is_null() {
                            return self.get_active_window_fallback();
                        }

                        // Get window title
                        let mut title_buf = vec![0u16; 256];
                        let title_len = GetWindowTextW(hwnd, title_buf.as_mut_ptr(), title_buf.len() as i32);
                        let title = if title_len > 0 {
                            title_buf.truncate(title_len as usize);
                            Some(OsString::from_wide(&title_buf).to_string_lossy().to_string())
                        } else {
                            None
                        };

                        // Get process ID
                        let mut process_id: DWORD = 0;
                        GetWindowThreadProcessId(hwnd, &mut process_id);
                        
                        // Get process name
                        let app_name = if process_id != 0 {
                            let handle = OpenProcess(winapi::um::winnt::PROCESS_QUERY_INFORMATION | winapi::um::winnt::PROCESS_VM_READ, 0, process_id);
                            if !handle.is_null() {
                                let mut name_buf = vec![0u16; MAX_PATH as usize];
                                let name_len = GetModuleBaseNameW(handle, std::ptr::null_mut(), name_buf.as_mut_ptr(), name_buf.len() as u32);
                                CloseHandle(handle);
                                if name_len > 0 {
                                    name_buf.truncate(name_len as usize);
                                    OsString::from_wide(&name_buf).to_string_lossy().to_string()
                                } else {
                                    format!("Process_{}", process_id)
                                }
                            } else {
                                format!("Process_{}", process_id)
                            }
                        } else {
                            "Unknown".to_string()
                        };

                        Some(WindowInfo {
                            app_name,
                            title,
                            process_id: if process_id != 0 { Some(process_id) } else { None },
                        })
                    }
                }
                #[cfg(not(windows))]
                {
                    // For non-Windows platforms, use window_id as app_name
                    Some(WindowInfo {
                        app_name: active_window.window_id,
                        title: None,
                        process_id: Some(active_window.process_id as u32),
                    })
                }
            }
            Err(_) => {
                // Fallback to platform-specific implementation if native API fails
                self.get_active_window_fallback()
            }
        }
    }

    /// Fallback implementation for platforms where native API might fail
    fn get_active_window_fallback(&self) -> Option<WindowInfo> {
        // If active-win-pos-rs fails, return None
        // The caller should handle this gracefully
        None
    }
}

impl Default for WindowTracker {
    fn default() -> Self {
        Self::new()
    }
}
