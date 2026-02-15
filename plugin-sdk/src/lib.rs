//! Time Tracker Plugin SDK
//!
//! This crate provides the core types and traits that plugins must implement
//! to integrate with the Time Tracker application.

pub mod plugin;
pub mod extensions;
pub mod api;
pub mod ffi;

pub use plugin::{Plugin, PluginInfo};
pub use extensions::{EntityType, ExtensionType, SchemaChange, ModelField, QueryFilter, ForeignKey, TableColumn, AutoTimestamp};
pub use api::{PluginAPIInterface, ActivityFilters};
pub use ffi::{PluginCreateFn, PluginDestroyFn};

/// SDK version for compatibility checking
pub const SDK_VERSION: &str = "1.0.0";
