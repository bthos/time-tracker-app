//! Tauri commands - IPC handlers for frontend communication
//! 
//! This module is organized into submodules by domain:
//! - activities: Activity-related commands
//! - categories: Category management commands
//! - rules: Rule management commands
//! - manual_entries: Manual entry commands
//! - settings: Settings management commands
//! - stats: Statistics commands
//! - tracking: Tracking control commands
//! - idle: Idle detection commands
//! - export: Export commands
//! - window: Window management commands
//! - domains: Domain statistics commands
//! - plugins: Plugin management commands
//! - common: Shared types and utilities

pub mod activities;
pub mod categories;
pub mod rules;
pub mod manual_entries;
pub mod settings;
pub mod stats;
pub mod tracking;
pub mod idle;
pub mod export;
pub mod window;
pub mod domains;
pub mod plugins;
pub mod common;

// Re-export AppState and common types
pub use common::AppState;

// Re-export commands from all modules
pub use activities::*;
pub use categories::*;
pub use rules::*;
pub use manual_entries::*;
pub use settings::*;
pub use stats::*;
pub use tracking::*;
pub use idle::*;
pub use export::*;
pub use window::*;
pub use domains::*;
pub use plugins::*;
