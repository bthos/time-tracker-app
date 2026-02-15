# Plugin SDK Reference

This document provides a comprehensive API reference for the **Time Tracker Plugin SDK** (`time-tracker-plugin-sdk`), the Rust crate that enables developers to create plugins for the Time Tracker application.

> **New to plugin development?** Start with the [Plugin Development Guide](./PLUGIN_DEVELOPMENT.md) for tutorials and step-by-step guides.

## Table of Contents

1. [Overview](#overview)
2. [Plugin Trait](#plugin-trait)
3. [Plugin API Interface](#plugin-api-interface)
4. [Extension System](#extension-system)
5. [Data Structures](#data-structures)
6. [FFI Bindings](#ffi-bindings)
7. [Frontend Integration](#frontend-integration)
8. [Version Information](#version-information)
9. [Limitations](#limitations)

## Overview

The Plugin SDK provides the core types and traits that plugins must implement to integrate with the Time Tracker application. It abstracts core functionality so plugins can extend the application without direct dependencies on the core codebase.

### Key Features

- **Database Access**: Read/write core application data through specific API methods
- **Schema Extensions**: Add custom database tables and columns to existing tables
- **Model Extensions**: Add fields to existing entity models
- **Command Interface**: Handle custom commands from frontend or core application
- **Frontend Integration**: Provide UI components via frontend bundles
- **Thread Safety**: Plugins must be `Send + Sync` for safe concurrent access

## Plugin Trait

All plugins must implement the `Plugin` trait, which defines the plugin lifecycle.

### Required Methods

#### `info() -> &PluginInfo`

Returns plugin metadata (ID, name, version, description).

**Returns:** Reference to `PluginInfo` struct containing plugin identification.

#### `initialize(api: &dyn PluginAPIInterface) -> Result<(), String>`

Called when the plugin is loaded. Use this to:
- Register schema extensions
- Register model extensions
- Register data hooks
- Register query filters
- Set up initial state

**Parameters:**
- `api`: Reference to the Plugin API interface

**Returns:** `Result<(), String>` - `Ok(())` on success, `Err(String)` on failure

**See also:** [Plugin Development Guide - Implementing the Plugin Trait](./PLUGIN_DEVELOPMENT.md#implementing-the-plugin-trait)

#### `invoke_command(command: &str, params: Value, api: &dyn PluginAPIInterface) -> Result<Value, String>`

Handles commands from the frontend or core application. Commands are string identifiers with JSON parameters.

**Parameters:**
- `command`: Command name (string identifier)
- `params`: Command parameters (JSON-serializable `serde_json::Value`)
- `api`: Reference to the Plugin API interface

**Returns:** `Result<serde_json::Value, String>` - Command result or error message

**See also:** [Plugin Development Guide - Implementing Plugin Commands](./PLUGIN_DEVELOPMENT.md#implementing-plugin-commands)

#### `shutdown() -> Result<(), String>`

Called when the plugin is disabled or uninstalled. Clean up resources here.

**Returns:** `Result<(), String>` - `Ok(())` on success, `Err(String)` on failure

### Optional Methods

#### `get_schema_extensions() -> Vec<SchemaExtension>`

Return schema extensions that this plugin requires. This is an alternative to registering them in `initialize()`.

**Returns:** Vector of schema extensions

#### `get_frontend_bundle() -> Option<Vec<u8>>`

Return frontend bundle bytes if the plugin provides UI. This is an alternative to using the `[frontend]` section in the manifest.

**Returns:** `Option<Vec<u8>>` - Frontend bundle bytes or `None`

## Plugin API Interface

The `PluginAPIInterface` trait provides plugins with access to core functionality.

### Extension Registration Methods

#### `register_schema_extension(entity_type: EntityType, schema_changes: Vec<SchemaChange>) -> Result<(), String>`

Register database schema extensions (add tables, columns, indexes, foreign keys).

**Parameters:**
- `entity_type`: Entity type to extend (`Activity`, `ManualEntry`, or `Category`)
- `schema_changes`: Vector of schema changes to apply

**Returns:** `Result<(), String>`

**See also:** [Schema Changes](#schema-changes)

#### `register_model_extension(entity_type: EntityType, model_fields: Vec<ModelField>) -> Result<(), String>`

Register model extensions (add fields to entity models).

**Parameters:**
- `entity_type`: Entity type to extend
- `model_fields`: Vector of model fields to add

**Returns:** `Result<(), String>`

#### `register_query_filters(entity_type: EntityType, query_filters: Vec<QueryFilter>) -> Result<(), String>`

Register query filters. Filters are applied in registration order when the core returns activity lists (e.g. `get_activities`). Each filter receives the current activity list and optional params and returns a filtered list.

**Note:** Backend conversion from SDK `QueryFilter` to core filter type may not be fully implemented; schema and model extensions are preferred when possible.

**Parameters:**
- `entity_type`: Entity type to filter
- `query_filters`: Vector of query filters

**Returns:** `Result<(), String>`

**Data hooks (backend-only):** The core supports data hooks that run after activity create/update. They are registered via the backend Plugin API's `register_data_hook()`. When an activity is upserted (tracker) or its category is updated, the core calls each plugin's hook with the activity and database; the hook can modify the activity and the core persists changes. Data hooks are not on the SDK trait; they are part of the core extension system. See [Plugin Development Guide — Data Hooks](./PLUGIN_DEVELOPMENT.md#data-hooks) for details.

### Core Application Methods

These methods provide access to core application entities (categories, activities, manual entries). Core entity commands accept and return plugin-extended fields. If your plugin adds columns to the categories table (e.g. `is_billable`, `hourly_rate`), pass them in create/update params and they will be stored; `get_categories` returns all columns including extended ones.

#### Categories

##### `get_categories() -> Result<serde_json::Value, String>`

Get all categories (returns array of objects with core + extended fields).

**Returns:** JSON array of category objects

**Category Object Structure:**
```json
{
  "id": 1,
  "name": "Development",
  "color": "#FF5733",
  "icon": "💻",
  "is_productive": true,
  "sort_order": 0,
  "is_system": false,
  "is_pinned": true
}
```

**Fields:**
- `id` (i64): Unique category identifier
- `name` (string): Category name
- `color` (string): Hex color code (e.g., "#FF5733")
- `icon` (string | null): Icon emoji or identifier, may be null
- `is_productive` (bool | null): Whether this category is productive, may be null
- `sort_order` (i64): Sort order for display
- `is_system` (bool): Whether this is a system category
- `is_pinned` (bool): Whether this category is pinned
- Additional fields may be present if plugins add schema extensions (extended fields are included automatically in JSON responses)

##### `create_category(params: serde_json::Value) -> Result<serde_json::Value, String>`

Create a category; params may include plugin-extended field names and values.

**Parameters:**
- `params`: Category data including core fields and any extended fields

**Returns:** Created category object

##### `update_category(params: serde_json::Value) -> Result<serde_json::Value, String>`

Update a category; params may include plugin-extended fields.

**Parameters:**
- `params`: Category data including `id` and fields to update

**Returns:** Updated category object

##### `delete_category(id: i64) -> Result<(), String>`

Delete a category by ID.

**Parameters:**
- `id`: Category ID to delete

**Returns:** `Result<(), String>`

#### Activities

##### `get_activities(start: i64, end: i64, limit: Option<i64>, offset: Option<i64>, filters: Option<ActivityFilters>) -> Result<serde_json::Value, String>`

Get activities in a time range with optional filters. Returns array of activity objects. Use for billing, goals, or analytics plugins that need to aggregate or analyze tracked time.

**Parameters:**
- `start`: Start timestamp (Unix timestamp in seconds)
- `end`: End timestamp (Unix timestamp in seconds)
- `limit`: Optional limit on number of results
- `offset`: Optional offset for pagination
- `filters`: Optional activity filters

**Returns:** JSON array of activity objects

**Activity Object Structure:**
```json
{
  "id": 123,
  "app_name": "code.exe",
  "window_title": "main.rs - Visual Studio Code",
  "domain": "github.com",
  "category_id": 5,
  "started_at": 1705276800,
  "duration_sec": 3600,
  "is_idle": false
}
```

**Fields:**
- `id` (i64): Unique activity identifier
- `app_name` (string): Application name (e.g., "code.exe")
- `window_title` (string | null): Window title, may be null
- `domain` (string | null): Domain name if applicable, may be null
- `category_id` (i64 | null): Associated category ID, may be null
- `started_at` (i64): Start timestamp (Unix timestamp in seconds)
- `duration_sec` (i64): Duration in seconds
- `is_idle` (bool): Whether this is an idle activity
- Additional fields may be present if plugins add schema extensions (extended fields are included automatically in JSON responses)

**ActivityFilters Structure:**
```rust
pub struct ActivityFilters {
    pub exclude_idle: Option<bool>,      // Exclude idle activities (is_idle = false)
    pub category_ids: Option<Vec<i64>>,  // Filter by category IDs
}
```

**Note:** Core API does not include plugin-specific filters. Plugins that need to filter by plugin-added fields should query activities without filters and filter results in plugin code, or use `query_plugin_table()` for cross-plugin data access.

#### Manual Entries

##### `get_manual_entries(start: i64, end: i64) -> Result<serde_json::Value, String>`

Get manual entries in a time range.

**Parameters:**
- `start`: Start timestamp (Unix timestamp in seconds)
- `end`: End timestamp (Unix timestamp in seconds)

**Returns:** JSON array of manual entry objects

##### `create_manual_entry(params: serde_json::Value) -> Result<serde_json::Value, String>`

Create a manual entry.

**Parameters:**
- `params`: Manual entry data including core fields and any extended fields

**Returns:** Created manual entry object

##### `update_manual_entry(params: serde_json::Value) -> Result<serde_json::Value, String>`

Update a manual entry.

**Parameters:**
- `params`: Manual entry data including `id` and fields to update

**Returns:** Updated manual entry object

##### `delete_manual_entry(id: i64) -> Result<(), String>`

Delete a manual entry by ID.

**Parameters:**
- `id`: Manual entry ID to delete

**Returns:** `Result<(), String>`

**ManualEntry Object Structure:**
```json
{
  "id": 42,
  "description": "Team meeting",
  "category_id": 3,
  "started_at": 1705276800,
  "ended_at": 1705280400
}
```

**Fields:**
- `id` (i64): Unique manual entry identifier
- `description` (string | null): Entry description, may be null
- `category_id` (i64 | null): Associated category ID, may be null
- `started_at` (i64): Start timestamp (Unix timestamp in seconds)
- `ended_at` (i64): End timestamp (Unix timestamp in seconds)
- Additional fields may be present if plugins add schema extensions (extended fields are included automatically in JSON responses)

### Plugin's Own Table Methods

Plugins that create tables via `SchemaChange::CreateTable` can perform CRUD and aggregation on those tables. A plugin may only access tables it created; core tables (e.g. `categories`, `activities`) are not accessible via these methods.

#### `insert_own_table(table: &str, data: serde_json::Value) -> Result<serde_json::Value, String>`

Insert a row into a plugin-owned table.

**Parameters:**
- `table`: Table name (must be alphanumeric or underscore)
- `data`: Row data as JSON object

**Returns:** `{ "id": row_id }`

**Security:** Table and column names must be alphanumeric or underscore. Plugins cannot access core application tables through these methods.

#### `query_own_table(table: &str, filters: Option<serde_json::Value>, order_by: Option<&str>, limit: Option<i64>) -> Result<serde_json::Value, String>`

Query rows from a plugin-owned table.

**Parameters:**
- `table`: Table name
- `filters`: Optional filter conditions (JSON object)
- `order_by`: Optional ORDER BY clause (e.g., "name ASC", "created_at DESC")
- `limit`: Optional limit on number of results

**Returns:** JSON array of row objects

#### `update_own_table(table: &str, id: i64, data: serde_json::Value) -> Result<serde_json::Value, String>`

Update a row in a plugin-owned table by ID.

**Parameters:**
- `table`: Table name
- `id`: Row ID to update
- `data`: Updated data as JSON object

**Returns:** `{ "updated": count }`

#### `delete_own_table(table: &str, id: i64) -> Result<serde_json::Value, String>`

Delete a row from a plugin-owned table by ID.

**Parameters:**
- `table`: Table name
- `id`: Row ID to delete

**Returns:** `{ "deleted": count }`

#### `aggregate_own_table(table: &str, filters: Option<serde_json::Value>, aggregations: serde_json::Value) -> Result<serde_json::Value, String>`

Run aggregations on a plugin-owned table.

**Parameters:**
- `table`: Table name
- `filters`: Optional filter conditions
- `aggregations`: Aggregation specification with keys:
  - `count`: `"*"` or column name
  - `sum`: Column name
  - `avg`: Column name
  - `min`: Column name
  - `max`: Column name
  - `group_by`: Array of column names

**Returns:** Object with keys such as `total_count`, `sum_<col>`, `avg_<col>`, `groups` (when `group_by` is used)

**Example:**
```rust
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
// Result: { "total_count": 10, "sum_duration_sec": 15000, "avg_duration_sec": 1500, "groups": [...] }
```

### Cross-Plugin Table Queries

#### `query_plugin_table(plugin_id: &str, table: &str, filters: Option<serde_json::Value>, order_by: Option<&str>, limit: Option<i64>) -> Result<serde_json::Value, String>`

Query a table owned by another plugin. This is a read-only operation.

**Parameters:**
- `plugin_id`: ID of the plugin that owns the table
- `table`: Table name to query
- `filters`: Optional filter conditions
- `order_by`: Optional ORDER BY clause
- `limit`: Optional limit on number of results

**Returns:** Array of row objects (same format as `query_own_table`)

**Errors:** Returns error if plugin not found, table not owned by specified plugin, table not exposed, or permission denied

**Permission Model:**
- Tables must be explicitly exposed in the plugin manifest using `exposed_tables`
- Use `allowed_plugins = ["*"]` to allow all plugins
- Use `allowed_plugins = ["plugin1", "plugin2"]` to allow specific plugins only
- Use `allowed_plugins = []` to deny all cross-plugin access
- If `exposed_tables` is not specified, tables are not accessible to other plugins (secure default)

**Accessing Extended Fields:**
All columns (including extended fields) are automatically included in query results. Extended fields are accessed the same way as core fields using JSON object access. When querying other plugins' tables via `query_plugin_table()`, all columns (including extended fields) are automatically included in the results. Extended fields added to core tables (activities, categories, manual_entries) via schema extensions are also automatically included when querying core data.

**See also:** [Plugin Development Guide - Cross-Plugin Integration](./PLUGIN_DEVELOPMENT.md#cross-plugin-integration)

### Deprecated Methods

#### `call_db_method(method: &str, params: serde_json::Value) -> Result<serde_json::Value, String>`

⚠️ **Deprecated**: Use specific methods instead:
- `get_categories()`, `create_category()`, `update_category()`, `delete_category()` for categories
- `get_activities()` for activities
- `get_manual_entries()`, `create_manual_entry()`, `update_manual_entry()`, `delete_manual_entry()` for manual entries
- `query_own_table()`, `insert_own_table()`, `update_own_table()`, `delete_own_table()`, `aggregate_own_table()` for plugin tables

This method will be removed in a future major version.

## Extension System

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

```rust
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

**Automatic timestamp management:** For plugin-created tables, you can mark columns with `auto_timestamp: Some(AutoTimestamp::Created)` or `Some(AutoTimestamp::Updated)`. The core will then set them automatically when not provided: `insert_table` sets both created and updated columns to the current Unix timestamp; `update_table` sets the updated column to the current timestamp. You can still override these values by passing them in the `data` object. Omit `auto_timestamp` (or set to `None`) for normal columns.

#### Add Column

```rust
SchemaChange::AddColumn {
    table: "activities".to_string(),
    column: "custom_field".to_string(),
    column_type: "TEXT".to_string(),
    default: Some("default_value".to_string()),
    foreign_key: None,
}
```

#### Add Index

Single-column index:
```rust
SchemaChange::AddIndex {
    table: "activities".to_string(),
    index: "idx_custom".to_string(),
    columns: vec!["custom_field".to_string()],
}
```

**Composite indexes** (multiple columns) improve queries that filter or sort by several columns. Pass two or more column names in `columns`. Column order matters: place the most selective or most frequently filtered column first.

```rust
SchemaChange::AddIndex {
    table: "tasks".to_string(),
    index: "idx_tasks_project_archived".to_string(),
    columns: vec!["project_id".to_string(), "archived".to_string()],
}
```

This helps queries like `SELECT * FROM tasks WHERE project_id = ? AND archived = ?` or `ORDER BY project_id, archived`. Use a composite index when you often filter/sort by the same set of columns together; use separate single-column indexes when you filter by each column on its own.

Indexes are applied during plugin initialization.

#### Add Foreign Key

```rust
SchemaChange::AddForeignKey {
    table: "activities".to_string(),
    column: "project_id".to_string(),
    foreign_table: "projects".to_string(),
    foreign_column: "id".to_string(),
}
```

**See also:** [Plugin Development Guide - Extensions](./PLUGIN_DEVELOPMENT.md#extensions)

## Data Structures

### PluginInfo

```rust
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
}
```

### TableColumn

```rust
pub struct TableColumn {
    pub name: String,
    pub column_type: String,
    pub primary_key: bool,
    pub nullable: bool,
    pub default: Option<String>,
    pub foreign_key: Option<ForeignKey>,
    pub auto_timestamp: Option<AutoTimestamp>,
}
```

### ForeignKey

```rust
pub struct ForeignKey {
    pub table: String,
    pub column: String,
}
```

### AutoTimestamp

```rust
pub enum AutoTimestamp {
    Created,
    Updated,
}
```

### ActivityFilters

```rust
pub struct ActivityFilters {
    pub exclude_idle: Option<bool>,
    pub category_ids: Option<Vec<i64>>,
}
```

## FFI Bindings

For dynamic library loading, plugins must export these functions:

### `_plugin_create() -> *mut dyn Plugin`

Creates plugin instance. Must be exported with `#[no_mangle]` and `extern "C"`.

**Returns:** Raw pointer to plugin instance

### `_plugin_destroy(plugin: *mut dyn Plugin)`

Destroys plugin instance. Must be exported with `#[no_mangle]` and `extern "C"`.

**Parameters:**
- `plugin`: Raw pointer to plugin instance (may be null)

**Example:**
```rust
#[no_mangle]
pub extern "C" fn _plugin_create() -> *mut dyn Plugin {
    Box::into_raw(Box::new(MyPlugin::new()))
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

**See also:** [Plugin Development Guide - Building and Packaging](./PLUGIN_DEVELOPMENT.md#building-and-packaging)

## Frontend Integration

### Invoking Plugin Commands

Frontend code invokes plugin commands using the core application's Tauri command `invoke_plugin_command`. This is the standard way for plugin UI to call backend logic.

```typescript
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke('invoke_plugin_command', {
  pluginId: 'plugin-id',
  command: 'command_name',
  params: { /* JSON-serializable parameters */ }
});
```

**Parameters:**
- **`pluginId`** (string): The plugin identifier from `plugin.toml`
- **`command`** (string): Command name that matches a handler in the plugin's `invoke_command` method
- **`params`** (object): Command parameters; must be JSON-serializable

**Returns:** JSON-serializable result from the plugin's `invoke_command` method.

**Errors:** Throws if the plugin is not found, the command is unknown, or the plugin returns an error string.

**See also:** [Plugin Development Guide - Frontend Integration](./PLUGIN_DEVELOPMENT.md#frontend-integration)

## Version Information

- **SDK Crate Version**: `0.2.8` (available on crates.io)
- **SDK Version Constant**: `1.0.0` (for compatibility checking)

## Limitations

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

## Thread Safety Requirements

- Plugins must be `Send + Sync`
- Use thread-safe data structures
- Avoid shared mutable state without synchronization

## Error Handling

- Always return descriptive error messages
- Handle missing parameters gracefully
- Validate input data
- Use `Result<T, String>` for operations that can fail

**See also:** [Plugin Development Guide - Best Practices](./PLUGIN_DEVELOPMENT.md#best-practices)

## Resources

- **SDK Documentation**: [crates.io/time-tracker-plugin-sdk](https://crates.io/crates/time-tracker-plugin-sdk)
- **Plugin Development Guide**: [PLUGIN_DEVELOPMENT.md](./PLUGIN_DEVELOPMENT.md)
- **Plugin Registry**: [GitHub Repository](https://github.com/tmtrckr/plugins-registry)
- **Core Application**: [GitHub Repository](https://github.com/bthos/time-tracker-app)
