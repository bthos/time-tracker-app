//! Plugin API interface trait
//!
//! This trait abstracts the Plugin API so that plugins can work with
//! any implementation. The concrete implementation in the core app
//! provides access to Database and ExtensionRegistry.

use crate::extensions::{EntityType, SchemaChange, ModelField, QueryFilter};
use serde_json;
use serde::{Deserialize, Serialize};

/// Filters for querying activities
/// 
/// Used with `get_activities()` to filter results at the database level.
/// All fields are optional - if not provided, no filtering is applied for that field.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityFilters {
    /// Exclude idle activities (where is_idle = true)
    pub exclude_idle: Option<bool>,
    /// Filter by category IDs (activities must have category_id in this list)
    pub category_ids: Option<Vec<i64>>,
}

/// Abstract interface for plugins to interact with Core
pub trait PluginAPIInterface: Send + Sync {
    /// Register a database schema extension
    fn register_schema_extension(
        &self,
        entity_type: EntityType,
        schema_changes: Vec<SchemaChange>,
    ) -> Result<(), String>;
    
    /// Register a model extension
    fn register_model_extension(
        &self,
        entity_type: EntityType,
        model_fields: Vec<ModelField>,
    ) -> Result<(), String>;
    
    /// Register query filters
    fn register_query_filters(
        &self,
        entity_type: EntityType,
        query_filters: Vec<QueryFilter>,
    ) -> Result<(), String>;
    
    // ============================================================================
    // Core Application Methods
    // ============================================================================
    
    /// Get all categories (returns array of objects with core + extended fields)
    fn get_categories(&self) -> Result<serde_json::Value, String>;
    
    /// Create a category; params may include plugin-extended field names and values
    fn create_category(&self, params: serde_json::Value) -> Result<serde_json::Value, String>;
    
    /// Update a category; params may include plugin-extended fields
    fn update_category(&self, params: serde_json::Value) -> Result<serde_json::Value, String>;
    
    /// Delete a category by ID
    fn delete_category(&self, id: i64) -> Result<(), String>;
    
    /// Get activities in a time range with optional filters
    /// 
    /// # Parameters
    /// - `start`: Start timestamp (Unix timestamp in seconds)
    /// - `end`: End timestamp (Unix timestamp in seconds)
    /// - `limit`: Optional maximum number of results
    /// - `offset`: Optional offset for pagination
    /// - `filters`: Optional filters to apply (exclude_idle, category_ids)
    /// 
    /// # Returns
    /// Array of activity objects (id, started_at, duration_sec, is_idle, category_id, and any plugin-extended fields)
    fn get_activities(
        &self,
        start: i64,
        end: i64,
        limit: Option<i64>,
        offset: Option<i64>,
        filters: Option<ActivityFilters>,
    ) -> Result<serde_json::Value, String>;
    
    /// Get manual entries in a time range
    fn get_manual_entries(&self, start: i64, end: i64) -> Result<serde_json::Value, String>;
    
    /// Create a manual entry
    fn create_manual_entry(&self, params: serde_json::Value) -> Result<serde_json::Value, String>;
    
    /// Update a manual entry
    fn update_manual_entry(&self, params: serde_json::Value) -> Result<serde_json::Value, String>;
    
    /// Delete a manual entry by ID
    fn delete_manual_entry(&self, id: i64) -> Result<(), String>;
    
    // ============================================================================
    // Plugin's Own Table Methods
    // ============================================================================
    
    /// Insert a row into a table owned by this plugin
    /// Returns: `{ "id": row_id }`
    fn insert_own_table(&self, table: &str, data: serde_json::Value) -> Result<serde_json::Value, String>;
    
    /// Query rows from a table owned by this plugin
    /// Returns: array of row objects
    fn query_own_table(
        &self,
        table: &str,
        filters: Option<serde_json::Value>,
        order_by: Option<&str>,
        limit: Option<i64>,
    ) -> Result<serde_json::Value, String>;
    
    /// Update a row in a table owned by this plugin
    /// Returns: `{ "updated": count }`
    fn update_own_table(&self, table: &str, id: i64, data: serde_json::Value) -> Result<serde_json::Value, String>;
    
    /// Delete a row from a table owned by this plugin
    /// Returns: `{ "deleted": count }`
    fn delete_own_table(&self, table: &str, id: i64) -> Result<serde_json::Value, String>;
    
    /// Run aggregations on a table owned by this plugin
    /// Returns: object with keys such as `total_count`, `sum_<col>`, `avg_<col>`, `groups` (when `group_by` is used)
    fn aggregate_own_table(
        &self,
        table: &str,
        filters: Option<serde_json::Value>,
        aggregations: serde_json::Value,
    ) -> Result<serde_json::Value, String>;
    
    // ============================================================================
    // Cross-Plugin Methods
    // ============================================================================
    
    /// Query a table owned by another plugin
    /// 
    /// # Parameters
    /// - `plugin_id`: ID of the plugin that owns the table
    /// - `table`: Table name to query
    /// - `filters`: Optional filter conditions (same format as select_table - JSON object with column names to values)
    /// - `order_by`: Optional ordering (e.g., "created_at DESC")
    /// - `limit`: Optional row limit (max 10000)
    /// 
    /// # Returns
    /// Array of row objects (same format as select_table)
    /// 
    /// # Errors
    /// - Plugin not found
    /// - Table not owned by specified plugin
    /// - Table not exposed for cross-plugin queries
    /// - Permission denied (not in allowed_plugins list)
    fn query_plugin_table(
        &self,
        plugin_id: &str,
        table: &str,
        filters: Option<serde_json::Value>,
        order_by: Option<&str>,
        limit: Option<i64>,
    ) -> Result<serde_json::Value, String>;
    
    // ============================================================================
    // Deprecated Methods
    // ============================================================================
    
    /// Call a database method by name with JSON parameters
    /// 
    /// # Deprecated
    /// This method is deprecated. Use specific methods instead:
    /// - `get_categories()`, `create_category()`, `update_category()`, `delete_category()` for categories
    /// - `get_activities()` for activities
    /// - `get_manual_entries()`, `create_manual_entry()`, `update_manual_entry()`, `delete_manual_entry()` for manual entries
    /// - `query_own_table()`, `insert_own_table()`, `update_own_table()`, `delete_own_table()`, `aggregate_own_table()` for plugin tables
    /// 
    /// This method will be removed in a future major version.
    #[deprecated(note = "Use specific methods instead: get_categories(), create_category(), query_own_table(), etc.")]
    fn call_db_method(&self, method: &str, params: serde_json::Value) -> Result<serde_json::Value, String>;
}
