# Time Tracker Plugin SDK

SDK for developing plugins for the Time Tracker application.

## Overview

This crate provides the core types and traits that plugins must implement to integrate with the Time Tracker application. It includes:

- **Plugin trait**: Core interface that all plugins must implement
- **Plugin API interface**: Abstract interface for plugins to interact with the core application
- **Schema extensions**: Support for plugins to extend the database schema
- **FFI bindings**: Foreign function interface for dynamic plugin loading

## Usage

Add this to your `Cargo.toml`:

```toml
[dependencies]
time-tracker-plugin-sdk = "0.2.8"
```

## Example

```rust
use time_tracker_plugin_sdk::{Plugin, PluginInfo, PluginAPIInterface};

pub struct MyPlugin {
    info: PluginInfo,
}

impl Plugin for MyPlugin {
    fn info(&self) -> &PluginInfo {
        &self.info
    }
    
    fn initialize(&mut self, api: &dyn PluginAPIInterface) -> Result<(), String> {
        // Initialize your plugin
        Ok(())
    }
    
    fn invoke_command(&self, command: &str, params: serde_json::Value, api: &dyn PluginAPIInterface) -> Result<serde_json::Value, String> {
        // Handle plugin commands
        Ok(serde_json::json!({}))
    }
    
    fn shutdown(&self) -> Result<(), String> {
        // Cleanup resources
        Ok(())
    }
}
```

## Documentation

For more information, see the [Time Tracker documentation](https://github.com/bthos/time-tracker-app).

## License

MIT
