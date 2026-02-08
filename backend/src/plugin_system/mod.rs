//! Plugin system module
//! 
//! Provides infrastructure for loading and managing plugins, including:
//! - Plugin registry
//! - Extension API for extending Core entities
//! - Dynamic library loading
//! - Plugin lifecycle management
//! - Plugin discovery from registry and GitHub
//! - Plugin installation and loading

pub mod registry;
pub mod extensions;
pub mod api;
pub mod discovery;
pub mod loader;

pub use registry::PluginRegistry;
pub use extensions::ExtensionRegistry;
pub use discovery::PluginDiscovery;
pub use loader::PluginLoader;
