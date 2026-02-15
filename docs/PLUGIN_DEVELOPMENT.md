# Plugin Development Guide

This guide provides comprehensive tutorials and step-by-step instructions for developing plugins for the Time Tracker application.

> **Looking for API reference?** See the [SDK Reference](./SDK_REFERENCE.md) for complete API documentation.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [Plugin Structure](#plugin-structure)
5. [Plugin Manifest](#plugin-manifest)
6. [Implementing the Plugin Trait](#implementing-the-plugin-trait)
7. [Plugin API](#plugin-api)
8. [Extensions](#extensions)
9. [Frontend Integration](#frontend-integration)
10. [Building and Packaging](#building-and-packaging)
11. [Publishing Plugins](#publishing-plugins)
12. [Best Practices](#best-practices)
13. [Examples](#examples)

## Overview

The Time Tracker plugin system allows developers to extend the application's functionality through dynamically loaded plugins. Plugins can:

- Extend database schemas
- Add custom fields to entities
- Hook into data processing pipelines
- Provide custom UI components
- Register query filters
- Interact with core application data

### Key Concepts

- **Plugin SDK**: The `time-tracker-plugin-sdk` crate provides the core types and traits
- **Plugin Registry**: Manages installed and loaded plugins
- **Extension Registry**: Manages extensions registered by plugins
- **Plugin API**: Interface for plugins to interact with the core application
- **Dynamic Loading**: Plugins are loaded as dynamic libraries (.dll/.so/.dylib)

## Architecture

### Plugin Lifecycle

1. **Discovery**: Plugins are discovered from registries or GitHub repositories
2. **Installation**: Plugin archives are downloaded and extracted to the plugins directory
3. **Loading**: Dynamic libraries are loaded at runtime
4. **Initialization**: Plugins are initialized with access to the Plugin API
5. **Registration**: Plugins register extensions and become active
6. **Execution**: Plugins handle commands and process data
7. **Shutdown**: Plugins clean up resources when disabled or uninstalled

### Directory Structure

Plugins are installed in a platform-specific data directory:

- **Windows**: `%APPDATA%\timetracker\plugins\{author}\{plugin_id}\`
- **macOS**: `~/Library/Application Support/timetracker/plugins/{author}/{plugin_id}/`
- **Linux**: `~/.local/share/timetracker/plugins/{author}/{plugin_id}/`

Each plugin directory contains:
- `plugin.toml` - Plugin manifest
- `{library_name}.{ext}` - Dynamic library file (.dll/.so/.dylib)
- Frontend assets (optional)

## Getting Started

### Prerequisites

- Rust toolchain (latest stable)
- `time-tracker-plugin-sdk` crate (available on crates.io)
- Understanding of Rust FFI and dynamic libraries

### Add SDK Dependency

Add the SDK to your `Cargo.toml`:

```toml
[dependencies]
time-tracker-plugin-sdk = "0.2.8"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### Create Plugin Project

Create a new Rust library project:

```bash
cargo new --lib my-plugin
cd my-plugin
```

Update `Cargo.toml` to build a dynamic library:

```toml
[lib]
crate-type = ["cdylib"]

[dependencies]
time-tracker-plugin-sdk = "0.2.8"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

## Plugin Structure

### Basic Plugin Implementation

```rust
use time_tracker_plugin_sdk::{Plugin, PluginInfo, PluginAPIInterface};
use serde_json;

pub struct MyPlugin {
    info: PluginInfo,
}

impl MyPlugin {
    pub fn new() -> Self {
        Self {
            info: PluginInfo {
                id: "my-plugin".to_string(),
                name: "My Plugin".to_string(),
                version: "1.0.0".to_string(),
                description: Some("A sample plugin".to_string()),
            },
        }
    }
}

impl Plugin for MyPlugin {
    fn info(&self) -> &PluginInfo {
        &self.info
    }
    
    fn initialize(&mut self, api: &dyn PluginAPIInterface) -> Result<(), String> {
        // Initialize your plugin
        // Register extensions, set up hooks, etc.
        Ok(())
    }
    
    fn invoke_command(&self, command: &str, params: serde_json::Value, api: &dyn PluginAPIInterface) -> Result<serde_json::Value, String> {
        match command {
            "hello" => {
                Ok(serde_json::json!({
                    "message": "Hello from plugin!"
                }))
            }
            _ => Err(format!("Unknown command: {}", command))
        }
    }
    
    fn shutdown(&self) -> Result<(), String> {
        // Cleanup resources
        Ok(())
    }
}

// FFI exports for dynamic loading
#[no_mangle]
pub extern "C" fn _plugin_create() -> *mut dyn Plugin {
    let plugin = MyPlugin::new();
    Box::into_raw(Box::new(plugin))
}

#[no_mangle]
pub extern "C" fn _plugin_destroy(plugin: *mut dyn Plugin) {
    if !plugin.is_null() {
        unsafe {
            let _ = Box::from_raw(plugin);
        }
    }
}
```

## Plugin Manifest

Every plugin must include a `plugin.toml` manifest file in its root directory.

### Manifest Structure

```toml
[plugin]
name = "my-plugin"
display_name = "My Plugin"
version = "1.0.0"
author = "Your Name"
description = "A description of your plugin"
repository = "https://github.com/yourusername/my-plugin"
license = "MIT"
api_version = "1.0.0"
min_core_version = "1.0.0"
max_core_version = "2.0.0"

[backend]
library_name = "my_plugin.dll"  # Windows
# library_name = "libmy_plugin.so"  # Linux
# library_name = "libmy_plugin.dylib"  # macOS

[frontend]
entry = "frontend/index.js"
components = ["MyComponent"]

# Optional: Plugin dependencies
[[plugin.dependencies]]
plugin_id = "another-plugin"
version = ">=1.0.0"

# Optional: Expose tables for cross-plugin queries
[[plugin.exposed_tables]]
table_name = "public_sessions"
allowed_plugins = ["*"]  # Allow all plugins
description = "Public session data available to all plugins"

[[plugin.exposed_tables]]
table_name = "focus_sessions"
allowed_plugins = ["goals-plugin"]  # Allow only specific plugins
description = "Completed focus sessions for goal tracking"

[[plugin.exposed_tables]]
table_name = "settings"
allowed_plugins = []  # Deny all cross-plugin access
```

### Manifest Fields

#### `[plugin]` Section

- **`name`** (required): Plugin identifier (lowercase, hyphens)
- **`display_name`** (optional): Human-readable name
- **`version`** (required): Semantic version (e.g., "1.0.0")
- **`author`** (required): Plugin author name
- **`description`** (required): Plugin description
- **`repository`** (optional): GitHub repository URL
- **`license`** (optional): License identifier
- **`api_version`** (optional): Required API version
- **`min_core_version`** (optional): Minimum core app version
- **`max_core_version`** (optional): Maximum core app version
- **`dependencies`** (optional): Array of plugin dependencies. Each dependency has:
  - `plugin_id` (required): ID of the required plugin
  - `version` (optional): Version constraint (e.g., `">=1.0.0"`, `"1.2.3"`)
- **`exposed_tables`** (optional): Array of tables exposed for cross-plugin queries. Each exposed table has:
  - `table_name` (required): Name of the table to expose
  - `allowed_plugins` (required array): List of plugin IDs allowed to query this table
    - Use `["*"]` to allow all plugins
    - Use `["plugin1", "plugin2"]` to allow specific plugins only
    - Use `[]` to deny all cross-plugin access (most restrictive)
  - `description` (optional): Description of the table's purpose

#### `[backend]` Section

- **`library_name`** (required): Name of the dynamic library file

#### `[frontend]` Section (Optional)

- **`entry`** (optional): Path to frontend entry point
- **`components`** (optional): List of component names to register

## Cross-Plugin Integration

Plugins can integrate with each other by querying exposed tables from other plugins. This enables powerful plugin-to-plugin workflows.

### Exposing Tables

To allow other plugins to query your plugin's tables, declare them in your `plugin.toml` manifest:

```toml
[[plugin.exposed_tables]]
table_name = "focus_sessions"
allowed_plugins = ["goals-plugin"]
description = "Completed focus sessions"
```

**Permission Levels:**
- **Allow all**: `allowed_plugins = ["*"]` - Any plugin can query this table
- **Allow specific**: `allowed_plugins = ["plugin1", "plugin2"]` - Only listed plugins can query
- **Deny all**: `allowed_plugins = []` - No cross-plugin access (most restrictive)

### Querying Other Plugins' Tables

Use `query_plugin_table` to query tables from other plugins:

```rust
fn invoke_command(&self, command: &str, params: serde_json::Value, api: &dyn PluginAPIInterface) -> Result<serde_json::Value, String> {
    match command {
        "get_pomodoro_sessions" => {
            let start_ts = params["start"].as_i64().ok_or("Missing start")?;
            let end_ts = params["end"].as_i64().ok_or("Missing end")?;
            
            // Query pomodoro plugin's focus_sessions table
            let sessions = api.query_plugin_table(
                "pomodoro-plugin",
                "focus_sessions",
                Some(serde_json::json!({
                    "completed": true,
                    "started_at": { "gte": start_ts, "lte": end_ts }
                })),
                Some("started_at DESC"),
                Some(100),
            )?;
            
            Ok(serde_json::json!({ "sessions": sessions }))
        }
        _ => Err("Unknown command".to_string())
    }
}
```

**Important Notes:**
- Tables must be explicitly exposed in the target plugin's manifest
- Cross-plugin queries are read-only (no modifications allowed)
- Permission checks are enforced at runtime
- If a plugin is not installed or a table is not exposed, the query will fail with an error

### Accessing Extended Fields from Other Plugins

When plugins expose tables via `exposed_tables`, all columns (including extended fields) are automatically included in query results. This allows plugins to access data that other plugins have added to core tables or their own tables.

#### Example: Accessing Project Data

**Scenario:** A billing plugin needs to access project information from a projects plugin.

**Step 1:** Projects plugin exposes its `projects` table in `plugin.toml`:
```toml
[[plugin.exposed_tables]]
table_name = "projects"
allowed_plugins = ["*"]  # Allow all plugins, or ["billing-plugin"] for specific access
description = "Project information including billing rates"
```

**Step 2:** Projects plugin creates a table with extended fields:
```rust
// In projects plugin initialization
api.register_schema_extension(
    EntityType::Activity,  // Or create a custom table
    vec![SchemaChange::CreateTable {
        table: "projects".to_string(),
        columns: vec![
            TableColumn {
                name: "id".to_string(),
                column_type: "INTEGER".to_string(),
                primary_key: true,
                nullable: false,
                default: None,
                foreign_key: None,
                auto_timestamp: None,
            },
            TableColumn {
                name: "name".to_string(),
                column_type: "TEXT".to_string(),
                primary_key: false,
                nullable: false,
                default: None,
                foreign_key: None,
                auto_timestamp: None,
            },
            TableColumn {
                name: "hourly_rate".to_string(),  // Extended field
                column_type: "REAL".to_string(),
                primary_key: false,
                nullable: true,
                default: None,
                foreign_key: None,
                auto_timestamp: None,
            },
            TableColumn {
                name: "is_billable".to_string(),  // Extended field
                column_type: "INTEGER".to_string(),
                primary_key: false,
                nullable: false,
                default: Some("1".to_string()),
                foreign_key: None,
                auto_timestamp: None,
            },
        ],
    }],
)?;
```

**Step 3:** Billing plugin queries the projects table:
```rust
fn invoke_command(&self, command: &str, params: serde_json::Value, api: &dyn PluginAPIInterface) -> Result<serde_json::Value, String> {
    match command {
        "get_billable_projects" => {
            // Query projects plugin's table - all fields (including extended) are included
            let projects = api.query_plugin_table(
                "projects-plugin",
                "projects",
                Some(serde_json::json!({
                    "is_billable": 1  // Filter by extended field
                })),
                Some("name ASC"),
                None,
            )?;
            
            // projects is an array of objects, each containing:
            // { "id": 1, "name": "Project A", "hourly_rate": 100.0, "is_billable": 1 }
            
            Ok(serde_json::json!({ "projects": projects }))
        }
        "calculate_billing" => {
            let start_ts = params["start"].as_i64().ok_or("Missing start")?;
            let end_ts = params["end"].as_i64().ok_or("Missing end")?;
            
            // Get activities
            let activities = api.get_activities(
                start_ts,
                end_ts,
                None,
                None,
                Some(ActivityFilters {
                    exclude_idle: Some(true),
                    category_ids: None,
                }),
            )?;
            
            // Get billable projects
            let projects_result = api.query_plugin_table(
                "projects-plugin",
                "projects",
                Some(serde_json::json!({ "is_billable": 1 })),
                None,
                None,
            );
            
            // Handle case where projects plugin might not be installed
            let projects = match projects_result {
                Ok(p) => p.as_array().cloned().unwrap_or_default(),
                Err(_) => {
                    // Projects plugin not available, continue without project data
                    vec![]
                }
            };
            
            // Create a map of project IDs to hourly rates
            let mut project_rates: std::collections::HashMap<i64, f64> = std::collections::HashMap::new();
            for project in projects {
                if let (Some(id), Some(rate)) = (
                    project.get("id").and_then(|v| v.as_i64()),
                    project.get("hourly_rate").and_then(|v| v.as_f64()),
                ) {
                    project_rates.insert(id, rate);
                }
            }
            
            // Calculate billing (example - would need project_id in activities via schema extension)
            let mut total_billing = 0.0;
            let activities_arr = activities.as_array().ok_or("Expected array")?;
            
            for activity in activities_arr {
                let duration_hours = activity.get("duration_sec")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(0) as f64 / 3600.0;
                
                // If activities have project_id (added via schema extension), use it
                // Otherwise, use category-based billing
                if let Some(project_id) = activity.get("project_id").and_then(|v| v.as_i64()) {
                    if let Some(&rate) = project_rates.get(&project_id) {
                        total_billing += duration_hours * rate;
                    }
                }
            }
            
            Ok(serde_json::json!({ "total_billing": total_billing }))
        }
        _ => Err("Unknown command".to_string())
    }
}
```

#### Example: Accessing Extended Fields from Core Tables

If a plugin extends core tables (activities, categories, manual_entries) with additional fields, those extended fields are automatically included when other plugins query core data.

**Scenario:** Projects plugin adds `project_id` to activities table, billing plugin accesses it.

**Step 1:** Projects plugin adds `project_id` column to activities:
```rust
// In projects plugin initialization
api.register_schema_extension(
    EntityType::Activity,
    vec![SchemaChange::AddColumn {
        table: "activities".to_string(),
        column: "project_id".to_string(),
        column_type: "INTEGER".to_string(),
        default: None,
        foreign_key: Some(ForeignKey {
            table: "projects".to_string(),
            column: "id".to_string(),
        }),
    }],
)?;
```

**Step 2:** Billing plugin queries activities - `project_id` is automatically included:
```rust
let activities = api.get_activities(start_ts, end_ts, None, None, None)?;
// Each activity object now includes "project_id" field if it was set
// { "id": 1, "app_name": "...", "project_id": 5, ... }
```

**Step 3:** Billing plugin can then query project details:
```rust
// Get unique project IDs from activities
let mut project_ids = std::collections::HashSet::new();
for activity in activities.as_array().unwrap_or(&vec![]) {
    if let Some(project_id) = activity.get("project_id").and_then(|v| v.as_i64()) {
        project_ids.insert(project_id);
    }
}

// Query project details for each project ID
for project_id in project_ids {
    let projects = api.query_plugin_table(
        "projects-plugin",
        "projects",
        Some(serde_json::json!({ "id": project_id })),
        None,
        Some(1),
    )?;
    // Use project data including extended fields like hourly_rate, is_billable
}
```

#### Best Practices for Cross-Plugin Field Access

**1. Handle Optional Plugins Gracefully:**
```rust
// Use .ok() to handle cases where other plugins might not be installed
let projects = api.query_plugin_table("projects-plugin", "projects", None, None, None)
    .ok()
    .and_then(|v| v.as_array().cloned());
    
if let Some(projects) = projects {
    // Use projects data
} else {
    // Plugin not available, continue without it
}
```

**2. Validate Extended Fields Exist:**
```rust
// Check if extended field exists before using it
if let Some(project_id) = activity.get("project_id").and_then(|v| v.as_i64()) {
    // Use project_id
} else {
    // Field not available (plugin not installed or field not set)
}
```

**3. Document Required Plugins:**
```toml
# In your plugin.toml
[[plugin.dependencies]]
plugin_id = "projects-plugin"
version = ">=1.0.0"
```

**4. Use Type-Safe Access Patterns:**
```rust
// Helper function to safely access extended fields
fn get_project_id(activity: &serde_json::Value) -> Option<i64> {
    activity.get("project_id")
        .and_then(|v| v.as_i64())
}

fn get_hourly_rate(project: &serde_json::Value) -> Option<f64> {
    project.get("hourly_rate")
        .and_then(|v| v.as_f64())
}
```

**5. Filter at Database Level When Possible:**
```rust
// Use filters in query_plugin_table to reduce data transfer
let billable_projects = api.query_plugin_table(
    "projects-plugin",
    "projects",
    Some(serde_json::json!({
        "is_billable": 1,
        "archived": 0
    })),
    Some("name ASC"),
    None,
)?;
```

**6. Cache Frequently Accessed Data:**
```rust
// Cache project data if accessed frequently
// (Implementation depends on your plugin's architecture)
let projects = self.cached_projects.get_or_insert_with(|| {
    api.query_plugin_table("projects-plugin", "projects", None, None, None)
        .ok()
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
});
```

### Plugin Dependencies

Declare plugin dependencies in your manifest to ensure required plugins are loaded before your plugin:

```toml
[[plugin.dependencies]]
plugin_id = "pomodoro-plugin"
version = ">=1.0.0"
```

The plugin system will:
- Validate all dependencies are installed before loading your plugin
- Load plugins in dependency order (topological sort)
- Detect and prevent circular dependencies
- Warn if dependencies are missing (but continue loading other plugins)

## Implementing the Plugin Trait

### Required Methods

#### `info() -> &PluginInfo`

Returns plugin metadata. This should return a reference to a static or owned `PluginInfo` struct.

#### `initialize(api: &dyn PluginAPIInterface) -> Result<(), String>`

Called when the plugin is loaded. Use this to:
- Register schema extensions
- Register model extensions
- Register data hooks
- Register query filters
- Set up initial state

```rust
fn initialize(&mut self, api: &dyn PluginAPIInterface) -> Result<(), String> {
    // Register schema extension
    api.register_schema_extension(
        EntityType::Activity,
        vec![SchemaChange::AddColumn {
            table: "activities".to_string(),
            column: "custom_field".to_string(),
            column_type: "TEXT".to_string(),
            default: None,
            foreign_key: None,
        }],
    )?;
    
    Ok(())
}
```

#### `invoke_command(command: &str, params: Value, api: &dyn PluginAPIInterface) -> Result<Value, String>`

Handles commands from the frontend or core application. Commands are string identifiers with JSON parameters.

```rust
fn invoke_command(&self, command: &str, params: serde_json::Value, api: &dyn PluginAPIInterface) -> Result<serde_json::Value, String> {
    match command {
        "get_data" => {
            // Use API to access database
            let result = api.get_categories()?;
            Ok(result)
        }
        "process" => {
            let input = params["input"].as_str().ok_or("Missing input")?;
            Ok(serde_json::json!({
                "output": format!("Processed: {}", input)
            }))
        }
        _ => Err(format!("Unknown command: {}", command))
    }
}
```

#### `shutdown() -> Result<(), String>`

Called when the plugin is disabled or uninstalled. Clean up resources here.

```rust
fn shutdown(&self) -> Result<(), String> {
    // Cleanup: close files, disconnect from services, etc.
    Ok(())
}
```

### Optional Methods

#### `get_schema_extensions() -> Vec<SchemaExtension>`

Return schema extensions that this plugin requires. This is an alternative to registering them in `initialize()`.

#### `get_frontend_bundle() -> Option<Vec<u8>>`

Return frontend bundle bytes if the plugin provides UI. This is an alternative to using the `[frontend]` section in the manifest.

## Plugin API

The `PluginAPIInterface` trait provides plugins with access to core functionality. This section covers common usage patterns. For complete API reference, see the [SDK Reference](./SDK_REFERENCE.md#plugin-api-interface).

### Database Access Overview

Plugins can access core application data (categories, activities, manual entries) and their own tables through specific API methods. All core entity commands accept and return plugin-extended fields automatically.

**Basic Usage Pattern:**
```rust
// Get all categories
let categories = api.get_categories()?;

// Create a category (with optional extended fields)
let category = api.create_category(serde_json::json!({
    "name": "My Category",
    "color": "#FF0000",
    "is_productive": true,
    // Extended fields from your plugin are automatically handled
}))?;
```

### Working with Activities

Activities are useful for plugins that analyze or aggregate tracked time (e.g., billing, goals, analytics):

```rust
use time_tracker_plugin_sdk::ActivityFilters;

// Get activities with filters
let filters = ActivityFilters {
    exclude_idle: Some(true),
    category_ids: Some(vec![1, 2, 3]),
};

let activities = api.get_activities(
    start_ts,
    end_ts,
    Some(100),  // limit
    Some(0),    // offset
    Some(filters),
)?;
```

**See also:** [SDK Reference - Activities](./SDK_REFERENCE.md#activities) for complete API documentation.

### Working with Plugin Tables

Plugins that create their own tables via `SchemaChange::CreateTable` can perform CRUD operations on those tables:

**Basic CRUD Pattern:**
```rust
// Insert
let result = api.insert_own_table("focus_sessions", serde_json::json!({
    "pomodoro_type": "work",
    "started_at": 1234567890,
    "duration_sec": 1500,
    "completed": false
}))?;
let id = result["id"].as_i64().ok_or("Missing id")?;

// Query
let rows = api.query_own_table(
    "focus_sessions",
    Some(serde_json::json!({ "completed": true })),
    Some("started_at DESC"),
    Some(10)
)?;

// Update
api.update_own_table("focus_sessions", session_id, serde_json::json!({
    "completed": true
}))?;

// Delete
api.delete_own_table("focus_sessions", session_id)?;

// Aggregate
let stats = api.aggregate_own_table(
    "focus_sessions",
    Some(serde_json::json!({ "completed": true })),
    serde_json::json!({
        "count": "*",
        "sum": "duration_sec",
        "avg": "duration_sec",
        "group_by": ["pomodoro_type"]
    })
)?;
```

**Best Practices:**
- Register `SchemaChange::AddIndex` for columns you filter or order by
- Use composite indexes for queries that filter/sort by multiple columns together
- For complete CRUD patterns and validation examples, see [SDK Reference - Plugin's Own Table Methods](./SDK_REFERENCE.md#plugins-own-table-methods)

### Extension Registration

Extensions allow plugins to extend the database schema, models, and data processing pipeline. Register extensions during `initialize()`.

#### Schema Extensions

Add columns or tables to the database:

```rust
api.register_schema_extension(
    EntityType::Activity,
    vec![
        SchemaChange::AddColumn {
            table: "activities".to_string(),
            column: "project_id".to_string(),
            column_type: "INTEGER".to_string(),
            default: None,
            foreign_key: Some(ForeignKey {
                table: "projects".to_string(),
                column: "id".to_string(),
            }),
        },
        SchemaChange::AddIndex {
            table: "activities".to_string(),
            index: "idx_activities_project".to_string(),
            columns: vec!["project_id".to_string()],
        },
    ],
)?;
```

**See also:** [SDK Reference - Schema Changes](./SDK_REFERENCE.md#schema-changes) for complete schema extension documentation.

#### Model Extensions

Add fields to entity models:

```rust
api.register_model_extension(
    EntityType::Activity,
    vec![
        ModelField {
            name: "project_id".to_string(),
            type_: "i64".to_string(),
            optional: true,
        },
    ],
)?;
```

#### Data Hooks

Data hooks run when activities are created or updated. The core applies all registered hooks after each activity upsert (in the tracker loop) and after an activity's category is updated via the UI.

- **When hooks run:** After `upsert_activity()` (tracker) and after `update_activity_category()` (command)
- **How to register:** Use the backend Plugin API's `register_data_hook()` during `initialize()`
- **Use cases:** Enrich activities with plugin-specific data, normalize fields, or sync to external systems

**Note:** Data hooks are backend-only and not part of the SDK trait. See [SDK Reference - Extension Registration](./SDK_REFERENCE.md#extension-registration-methods) for details.

#### Query Filters

Query filters are applied **after** the database query when the frontend or core calls `get_activities`. Each plugin's filters run in registration order.

- **When filters run:** When `get_activities` is invoked (e.g. from the activities view)
- **How to register:** Call `api.register_query_filters(EntityType::Activity, query_filters)` in `initialize()`
- **Limitation:** The SDK's `register_query_filters` currently has limited support; schema and model extensions are preferred when possible

## Extensions

Extensions allow plugins to extend the application's database schema, models, and data processing. This section covers common patterns. For complete reference, see [SDK Reference - Extension System](./SDK_REFERENCE.md#extension-system).

### Entity Types

Plugins can extend these entity types:

- **`Activity`**: Automatic time tracking entries
- **`ManualEntry`**: Manually created time entries
- **`Category`**: Activity categories

### Extension Types

- **`DatabaseSchema`**: Database schema changes (tables, columns, indexes)
- **`Model`**: Model field additions
- **`DataHook`**: Hooks into data processing (backend-only)
- **`Query`**: Query filters (limited support)
- **`UIForm`**: UI form extensions (planned)

### Schema Changes

#### Create Table

When creating plugin tables, use automatic timestamps for `created_at` and `updated_at`:

```rust
use time_tracker_plugin_sdk::{SchemaChange, TableColumn, AutoTimestamp};

SchemaChange::CreateTable {
    table: "plugin_data".to_string(),
    columns: vec![
        TableColumn {
            name: "id".to_string(),
            column_type: "INTEGER".to_string(),
            primary_key: true,
            nullable: false,
            default: None,
            foreign_key: None,
            auto_timestamp: None,
        },
        TableColumn {
            name: "created_at".to_string(),
            column_type: "INTEGER".to_string(),
            primary_key: false,
            nullable: false,
            default: None,
            foreign_key: None,
            auto_timestamp: Some(AutoTimestamp::Created),
        },
        TableColumn {
            name: "updated_at".to_string(),
            column_type: "INTEGER".to_string(),
            primary_key: false,
            nullable: false,
            default: None,
            foreign_key: None,
            auto_timestamp: Some(AutoTimestamp::Updated),
        },
    ],
}
```

**Automatic timestamps:** The core sets `created_at` and `updated_at` automatically when you use `AutoTimestamp::Created` and `AutoTimestamp::Updated`. You can still override these values by passing them explicitly.

#### Add Column to Core Tables

```rust
SchemaChange::AddColumn {
    table: "activities".to_string(),
    column: "custom_field".to_string(),
    column_type: "TEXT".to_string(),
    default: Some("default_value".to_string()),
    foreign_key: None,
}
```

#### Add Indexes

**Single-column index:**
```rust
SchemaChange::AddIndex {
    table: "activities".to_string(),
    index: "idx_custom".to_string(),
    columns: vec!["custom_field".to_string()],
}
```

**Composite index** (for queries filtering/sorting by multiple columns):
```rust
// Optimizes: WHERE project_id = ? AND archived = ?
SchemaChange::AddIndex {
    table: "tasks".to_string(),
    index: "idx_tasks_project_archived".to_string(),
    columns: vec!["project_id".to_string(), "archived".to_string()],
}
```

**Best practice:** Use composite indexes when you often filter/sort by the same set of columns together. Use separate single-column indexes when you filter by each column independently.

#### Add Foreign Key

```rust
SchemaChange::AddForeignKey {
    table: "activities".to_string(),
    column: "project_id".to_string(),
    foreign_table: "projects".to_string(),
    foreign_column: "id".to_string(),
}
```

**See also:** [SDK Reference - Schema Changes](./SDK_REFERENCE.md#schema-changes) for complete schema extension reference.

## Frontend Integration

### Frontend Bundle

Plugins can provide frontend code that integrates with the application UI.

#### Option 1: Manifest Entry Point

Specify an entry point in `plugin.toml`:

```toml
[frontend]
entry = "frontend/index.js"
components = ["MyComponent"]
```

The entry file should export components and register them with the application.

#### Option 2: Bundle Bytes

Return frontend bundle from `get_frontend_bundle()`:

```rust
fn get_frontend_bundle(&self) -> Option<Vec<u8>> {
    Some(include_bytes!("../frontend/bundle.js").to_vec())
}
```

### Frontend API

From the frontend, plugins can be invoked using Tauri commands. See [SDK Reference - Frontend Integration](./SDK_REFERENCE.md#frontend-integration) for complete API documentation.

**Basic usage:**
```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Invoke a plugin command
const result = await invoke('invoke_plugin_command', {
  pluginId: 'my-plugin',
  command: 'hello',
  params: { name: 'World' }
});
```

### Frontend-to-Backend Communication

Plugins expose backend functionality through the `invoke_command` method. Frontend code invokes these commands using the core application's Tauri command `invoke_plugin_command`.

#### Basic Pattern

```typescript
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke('invoke_plugin_command', {
  pluginId: 'your-plugin-id',
  command: 'your_command',
  params: { /* command parameters */ }
});
```

**Parameters:**
- `pluginId` (string): The plugin identifier from `plugin.toml` (e.g. `projects-tasks-plugin`)
- `command` (string): Command name that matches a handler in the plugin's `invoke_command` method
- `params` (object): JSON-serializable parameters passed to the plugin

**Returns:** The JSON-serializable result from the plugin's `invoke_command` method (as `Promise<serde_json::Value>`).

**Errors:** Throws if the plugin is not found, the command is unknown, or the plugin returns an error.

#### TypeScript Example with Error Handling

```typescript
import { invoke } from '@tauri-apps/api/tauri';

async function getPluginData(pluginId: string, command: string, params: Record<string, unknown> = {}) {
  try {
    const result = await invoke('invoke_plugin_command', {
      pluginId,
      command,
      params,
    });
    return result;
  } catch (error) {
    console.error(`Plugin command failed: ${command}`, error);
    // Error is typically a string from the plugin
    throw new Error(typeof error === 'string' ? error : 'Unknown error');
  }
}

// Usage
const categories = await getPluginData('my-plugin', 'get_categories');
```

#### Creating an API Service

Plugins should provide a typed API service for their frontend so that hooks and components can call backend commands in a consistent way:

```typescript
// frontend/src/services/api.ts (in your plugin)
import { invoke } from '@tauri-apps/api/tauri';

const PLUGIN_ID = 'your-plugin-id';

async function invokeCommand<T>(command: string, params: Record<string, unknown> = {}): Promise<T> {
  return invoke<T>('invoke_plugin_command', {
    pluginId: PLUGIN_ID,
    command,
    params,
  });
}

export const api = {
  yourEntity: {
    getAll: () => invokeCommand('get_all', {}),
    getById: (id: number) => invokeCommand('get_by_id', { id }),
    create: (data: CreateData) => invokeCommand('create', data),
    update: (id: number, data: UpdateData) => invokeCommand('update', { id, ...data }),
    delete: (id: number) => invokeCommand('delete', { id }),
  },
};
```

#### Error Handling

Plugin commands can return errors (e.g. validation failures, missing data). Handle them in the frontend:

```typescript
try {
  const result = await api.yourEntity.getAll();
  // Use result
} catch (error) {
  console.error('Plugin command failed:', error);
  // Show user-friendly message; error is typically a string from the plugin
}
```

If the app uses a shared `invoke` helper that checks for Tauri availability, use that instead of importing from `@tauri-apps/api/tauri` directly so that plugin UI degrades gracefully when not running in the desktop app.

### Plugin Loader

The frontend includes a plugin loader utility (`frontend/utils/pluginLoader.ts`) that handles loading plugin frontend code.

## Building and Packaging

### Build Configuration

Ensure your `Cargo.toml` is configured for dynamic library output:

```toml
[lib]
crate-type = ["cdylib"]
```

### Platform-Specific Builds

Build for different platforms:

```bash
# Windows
cargo build --release --target x86_64-pc-windows-msvc

# Linux
cargo build --release --target x86_64-unknown-linux-gnu

# macOS
cargo build --release --target x86_64-apple-darwin
# or
cargo build --release --target aarch64-apple-darwin
```

### Packaging

Create a release archive containing:

1. `plugin.toml` - Plugin manifest
2. `{library_name}.{ext}` - Compiled dynamic library
3. Frontend files (if any)

#### ZIP Archive Structure

```
my-plugin-1.0.0-windows-x86_64.zip
├── plugin.toml
├── my_plugin.dll
└── frontend/
    └── index.js (optional)
```

#### Naming Convention

Recommended naming for release assets:
- `{plugin-name}-{version}-{platform}-{arch}.zip`
- Example: `pomodoro-plugin-1.0.0-windows-x86_64.zip`

### GitHub Releases

Create a GitHub release with platform-specific assets:

1. Tag your release: `v1.0.0`
2. Upload platform-specific ZIP files
3. The plugin discovery system will automatically find the correct asset

## Publishing Plugins

### Plugin Registry

Plugins can be published to the official registry or custom registries.

#### Registry Format

The registry is a JSON file containing plugin metadata:

```json
{
  "version": "1.0",
  "last_updated": "2026-02-14T00:00:00Z",
  "plugins": [
    {
      "id": "my-plugin",
      "name": "My Plugin",
      "author": "Your Name",
      "repository": "https://github.com/yourusername/my-plugin",
      "latest_version": "1.0.0",
      "description": "Plugin description",
      "category": "productivity",
      "verified": false,
      "downloads": 0,
      "tags": ["time-tracking", "productivity"],
      "license": "MIT",
      "min_core_version": "1.0.0",
      "max_core_version": "2.0.0",
      "api_version": "1.0.0"
    }
  ]
}
```

### Installation Methods

Users can install plugins via:

1. **Registry**: Browse and install from the plugin registry
2. **GitHub URL**: Install directly from a GitHub repository
3. **Manual**: Place plugin files in the plugins directory

### Discovery

The plugin discovery system:

1. Checks configured registries
2. Fetches plugin manifests from GitHub
3. Downloads releases from GitHub
4. Validates manifests
5. Installs plugins to the plugins directory

## Best Practices

### Plugin ID

- Use lowercase letters, numbers, and hyphens
- Keep it short and descriptive
- Example: `pomodoro-timer`, `project-tracker`

### Versioning

- Follow semantic versioning (MAJOR.MINOR.PATCH)
- Increment version for each release
- Update version in both `plugin.toml` and `PluginInfo`

### Error Handling

- Always return descriptive error messages
- Handle missing parameters gracefully
- Validate input data

#### Error Handling Best Practices

**Use `Result<T, String>` Pattern:**
Plugins should return `Result<T, String>` for operations that can fail. Return descriptive error messages so the frontend can display them to users.

```rust
fn invoke_command(&self, command: &str, params: serde_json::Value, api: &dyn PluginAPIInterface) -> Result<serde_json::Value, String> {
    match command {
        "process" => {
            let input = params.get("input")
                .and_then(|v| v.as_str())
                .ok_or("Missing required parameter: input")?;
            
            if input.is_empty() {
                return Err("Input cannot be empty".to_string());
            }
            
            // Process input...
            Ok(serde_json::json!({ "result": "success" }))
        }
        _ => Err(format!("Unknown command: {}", command))
    }
}
```

**Validate Parameters Before API Calls:**
Always validate parameters before calling API methods to provide clear error messages:

```rust
// Required string
let name = params["name"].as_str().ok_or("Missing required parameter: name")?;
if name.is_empty() {
    return Err("Name cannot be empty".to_string());
}

// Optional with default
let color = params.get("color").and_then(|v| v.as_str()).unwrap_or("#888888");

// Required ID
let id = params["id"].as_i64().ok_or("Missing required parameter: id")?;

// Optional number with range check
let rate = params.get("hourly_rate")
    .and_then(|v| v.as_f64())
    .filter(|&r| r >= 0.0);
```

**Propagate Errors:**
Use the `?` operator to propagate errors from API methods:

```rust
let categories = api.get_categories()?;  // Propagates error if get_categories fails
let result = api.create_category(params)?;
```

**Frontend Error Handling:**
Frontend should handle errors gracefully:

```typescript
try {
  const result = await invoke('invoke_plugin_command', {
    pluginId: 'my-plugin',
    command: 'process',
    params: { input: 'data' }
  });
  // Use result
} catch (error) {
  console.error('Plugin command failed:', error);
  // Show user-friendly message; error is typically a string from the plugin
  showError(typeof error === 'string' ? error : 'Unknown error');
}
```

**Use `.ok()` for Optional Features:**
When checking for optional plugin features (e.g., cross-plugin data), use `.ok()` to handle gracefully:

```rust
// Try to query another plugin's table, but don't fail if plugin doesn't exist
if let Ok(projects) = api.query_plugin_table("projects-plugin", "projects", None, None, None) {
    // Use projects data
} else {
    // Plugin not available, continue without it
}
```

```rust
fn invoke_command(&self, command: &str, params: serde_json::Value, api: &dyn PluginAPIInterface) -> Result<serde_json::Value, String> {
    match command {
        "process" => {
            let input = params.get("input")
                .and_then(|v| v.as_str())
                .ok_or("Missing required parameter: input")?;
            
            // Process input...
            Ok(serde_json::json!({ "result": "success" }))
        }
        _ => Err(format!("Unknown command: {}", command))
    }
}
```

### Resource Management

- Clean up resources in `shutdown()`
- Avoid memory leaks
- Release file handles and network connections

### Thread Safety

- Plugins must be `Send + Sync`
- Use thread-safe data structures
- Avoid shared mutable state without synchronization

### Performance Considerations

**Date Ranges:**
- Use reasonable date range limits (suggest max 1 year per query)
- Break large date ranges into smaller chunks if needed
- Consider caching results on the frontend for frequently accessed data

**Pagination:**
- Use `limit` and `offset` parameters for large datasets
- Implement lazy loading in frontend UI
- Default to reasonable page sizes (e.g., 100-1000 items)

**Filtering:**
- Use plugin-side filtering when possible (e.g., `ActivityFilters` for activities)
- Filter at database level rather than in plugin code when filters are available
- For plugin-extended fields, filter client-side after querying

**Caching:**
- Consider caching results on frontend for frequently accessed data
- Cache category lists, settings, and other relatively static data
- Invalidate cache when data changes

**Large Datasets:**
- Use aggregation methods (`aggregate_own_table`) instead of loading all rows
- Process data in batches when dealing with large time ranges
- Consider using database indexes for frequently queried columns

### Date Format

**Unix Timestamps in Seconds:**
- All timestamps use Unix timestamps in seconds (i64)
- Frontend conversion: `Math.floor(date.getTime() / 1000)` to convert JavaScript Date to Unix timestamp
- Backend conversion: `date.getTime() / 1000` returns seconds (JavaScript Date is in milliseconds)
- Timezone: All timestamps are UTC-based
- No DST handling needed (Unix timestamps are timezone-agnostic)

**Examples:**
```rust
// Rust: Get current timestamp
let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap()
    .as_secs() as i64;
```

```typescript
// TypeScript: Convert Date to Unix timestamp
const timestamp = Math.floor(new Date().getTime() / 1000);

// TypeScript: Convert Unix timestamp to Date
const date = new Date(timestamp * 1000);
```

### Plugin-Extended Fields

**Automatic Inclusion:**
- Extended fields are automatically included in JSON responses for all API methods
- Field names use snake_case in JSON (matching database column names)
- Extended fields may be null/undefined if not set

**Adding Extended Fields:**
- Plugins can add columns to core tables via schema extensions
- Extended columns automatically appear in JSON responses
- Example use cases: billing rates, project associations, custom metadata

**Example:**
```rust
// Plugin adds custom column to categories table
api.register_schema_extension(
    EntityType::Category,
    vec![SchemaChange::AddColumn {
        table: "categories".to_string(),
        column: "custom_field".to_string(),
        column_type: "TEXT".to_string(),
        default: None,
        foreign_key: None,
    }],
)?;

// Later, when calling get_categories(), the custom_field will be included:
let categories = api.get_categories()?;
// categories[0] will include "custom_field" if it was set
```

**Filtering Extended Fields:**
- Core API does not include plugin-specific filters
- Plugins should query without filters, then filter results in plugin code
- Or use schema extensions to add columns, then filter client-side after querying

### Schema Extensions

**Extending Core Tables:**
Plugins can extend core tables (activities, categories, manual_entries) with custom fields using schema extensions.

**How to Add Custom Fields:**
1. Use `SchemaChange::AddColumn` to add custom columns to core tables
2. Plugins that add schema extensions should manage their own extensions
3. Extended columns automatically appear in JSON responses for all API methods
4. Core models don't include plugin-specific fields by default

**Example:**
```rust
// Add a custom column to the activities table
api.register_schema_extension(
    EntityType::Activity,
    vec![SchemaChange::AddColumn {
        table: "activities".to_string(),
        column: "custom_field".to_string(),
        column_type: "INTEGER".to_string(),
        default: Some("0".to_string()),
        foreign_key: None,
    }],
)?;
```

**Important Notes:**
- Other plugins can query extended fields once the extension exists
- Filtering by extended fields should be done client-side after querying (core API doesn't include plugin-specific filters)
- Core API remains generic and doesn't depend on specific extensions
- Extended fields are included automatically in JSON responses

**Best Practices:**
- Use descriptive column names (e.g., `billing_rate`, `project_id`)
- Set appropriate defaults for new columns
- Consider adding indexes for frequently queried extended columns
- Document your schema extensions in your plugin's README

### Testing

- Test plugin initialization
- Test all commands
- Test error cases
- Test with different core app versions

### Documentation

- Document all commands
- Provide usage examples
- Include a README in your repository
- Document required permissions or dependencies

## Examples

### Minimal Plugin

```rust
use time_tracker_plugin_sdk::{Plugin, PluginInfo, PluginAPIInterface};
use serde_json;

pub struct MinimalPlugin {
    info: PluginInfo,
}

impl MinimalPlugin {
    pub fn new() -> Self {
        Self {
            info: PluginInfo {
                id: "minimal-plugin".to_string(),
                name: "Minimal Plugin".to_string(),
                version: "1.0.0".to_string(),
                description: Some("A minimal example plugin".to_string()),
            },
        }
    }
}

impl Plugin for MinimalPlugin {
    fn info(&self) -> &PluginInfo {
        &self.info
    }
    
    fn initialize(&mut self, _api: &dyn PluginAPIInterface) -> Result<(), String> {
        Ok(())
    }
    
    fn invoke_command(&self, command: &str, _params: serde_json::Value, _api: &dyn PluginAPIInterface) -> Result<serde_json::Value, String> {
        match command {
            "ping" => Ok(serde_json::json!({ "pong": true })),
            _ => Err(format!("Unknown command: {}", command))
        }
    }
    
    fn shutdown(&self) -> Result<(), String> {
        Ok(())
    }
}

#[no_mangle]
pub extern "C" fn _plugin_create() -> *mut dyn Plugin {
    Box::into_raw(Box::new(MinimalPlugin::new()))
}

#[no_mangle]
pub extern "C" fn _plugin_destroy(plugin: *mut dyn Plugin) {
    if !plugin.is_null() {
        unsafe {
            let _ = Box::from_raw(plugin);
        }
    }
}
```

### Plugin with Schema Extension

```rust
use time_tracker_plugin_sdk::{
    Plugin, PluginInfo, PluginAPIInterface,
    EntityType, SchemaChange, ForeignKey
};

pub struct SchemaExtensionPlugin {
    info: PluginInfo,
}

impl Plugin for SchemaExtensionPlugin {
    // ... info, invoke_command, shutdown ...
    
    fn initialize(&mut self, api: &dyn PluginAPIInterface) -> Result<(), String> {
        // Add a project_id column to activities
        api.register_schema_extension(
            EntityType::Activity,
            vec![
                SchemaChange::AddColumn {
                    table: "activities".to_string(),
                    column: "project_id".to_string(),
                    column_type: "INTEGER".to_string(),
                    default: None,
                    foreign_key: Some(ForeignKey {
                        table: "projects".to_string(),
                        column: "id".to_string(),
                    }),
                },
            ],
        )?;
        
        Ok(())
    }
}
```

### Plugin with Database Access

```rust
fn invoke_command(&self, command: &str, params: serde_json::Value, api: &dyn PluginAPIInterface) -> Result<serde_json::Value, String> {
    match command {
        "get_category_count" => {
            let categories = api.get_categories()?;
            let count = categories.as_array()
                .map(|arr| arr.len())
                .unwrap_or(0);
            
            Ok(serde_json::json!({ "count": count }))
        }
        "create_custom_category" => {
            let name = params.get("name")
                .and_then(|v| v.as_str())
                .ok_or("Missing name parameter")?;
            
            let category = api.create_category(serde_json::json!({
                "name": name,
                "color": "#FF5733",
                "is_productive": true
            }))?;
            
            Ok(category)
        }
        _ => Err(format!("Unknown command: {}", command))
    }
}
```

## Limitations and Future Work

### Current Limitations

1. **Query Filters**: Limited support for query filters in the SDK
2. **Frontend Integration**: Frontend bundle loading is basic
3. **UI Extensions**: UI form extensions are planned but not yet implemented
4. **Plugin Dependencies**: No support for plugin-to-plugin dependencies
5. **Hot Reloading**: Plugins must be disabled/enabled to reload changes

### Future Enhancements

- Enhanced query filter support
- UI component registration
- Plugin dependency management
- Hot reloading for development
- Plugin marketplace integration
- Plugin signing and verification
- Performance monitoring and metrics

## Troubleshooting

### Plugin Not Loading

- Check that `plugin.toml` is valid
- Verify library file exists and matches `library_name`
- Check that FFI exports (`_plugin_create`, `_plugin_destroy`) are present
- Ensure plugin is compiled for the correct platform

### Initialization Errors

- Verify all required database tables exist
- Check schema extension compatibility
- Ensure API version matches core app version

### Command Errors

- Validate command names match exactly
- Check parameter types and required fields
- Verify database method names are correct

### Frontend Issues

- Ensure frontend entry point exists
- Check component registration
- Verify frontend bundle format

## Resources

- **SDK Reference**: [SDK_REFERENCE.md](./SDK_REFERENCE.md) - Complete API reference
- **SDK Documentation**: [crates.io/time-tracker-plugin-sdk](https://crates.io/crates/time-tracker-plugin-sdk)
- **Plugin Registry**: [GitHub Repository](https://github.com/tmtrckr/plugins-registry)
- **Core Application**: [GitHub Repository](https://github.com/bthos/time-tracker-app)
- **Issues and Support**: [GitHub Issues](https://github.com/bthos/time-tracker-app/issues)

## License

Plugins should include appropriate license information in their manifest and repository. The core application uses the MIT license, but plugins may use any compatible license.
