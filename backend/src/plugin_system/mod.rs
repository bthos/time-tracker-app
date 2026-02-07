//! Plugin system module
//! 
//! Provides infrastructure for loading and managing plugins, including:
//! - Plugin registry
//! - Extension API for extending Core entities
//! - Dynamic library loading
//! - Plugin lifecycle management

pub mod registry;
pub mod extensions;
pub mod api;

pub use registry::{PluginRegistry, Plugin, PluginInfo};
pub use extensions::{ExtensionRegistry, Extension, ExtensionType, EntityType, SchemaChange, ModelField};
pub use api::PluginAPI;
