//! Extension types for plugins to extend Core entities

/// Entity types that can be extended
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum EntityType {
    Activity,
    ManualEntry,
    Category,
}

/// Types of extensions
#[derive(Debug, Clone, PartialEq)]
pub enum ExtensionType {
    DatabaseSchema,
    Model,
    DataHook,
    Query,
    UIForm,
}

/// Schema change operations
#[derive(Debug, Clone)]
pub enum SchemaChange {
    /// Create a new table
    CreateTable {
        table: String,
        columns: Vec<TableColumn>,
    },
    /// Add a column to an existing table
    AddColumn {
        table: String,
        column: String,
        column_type: String,
        default: Option<String>,
        foreign_key: Option<ForeignKey>,
    },
    /// Add an index
    AddIndex {
        table: String,
        index: String,
        columns: Vec<String>,
    },
    /// Add a foreign key constraint
    AddForeignKey {
        table: String,
        column: String,
        foreign_table: String,
        foreign_column: String,
    },
}

/// Marks a column as automatically set on insert and/or update (e.g. created_at, updated_at).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AutoTimestamp {
    /// Set once when the row is inserted (e.g. created_at).
    Created,
    /// Set on insert and updated on every update (e.g. updated_at).
    Updated,
}

/// Table column definition for CreateTable
#[derive(Debug, Clone)]
pub struct TableColumn {
    pub name: String,
    pub column_type: String,
    pub primary_key: bool,
    pub nullable: bool,
    pub default: Option<String>,
    pub foreign_key: Option<ForeignKey>,
    /// If set, the core will automatically set this column on insert/update (Unix timestamp).
    pub auto_timestamp: Option<AutoTimestamp>,
}

/// Foreign key definition
#[derive(Debug, Clone)]
pub struct ForeignKey {
    pub table: String,
    pub column: String,
}

/// Model field definition
#[derive(Debug, Clone)]
pub struct ModelField {
    pub name: String,
    pub type_: String,
    pub optional: bool,
}

/// Query filter function type
pub type QueryFilterFn = Box<dyn Fn(Vec<serde_json::Value>, std::collections::HashMap<String, serde_json::Value>) -> Result<Vec<serde_json::Value>, String> + Send + Sync>;

/// Query filter
pub struct QueryFilter {
    pub name: String,
    pub filter_fn: QueryFilterFn,
}

impl std::fmt::Debug for QueryFilter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("QueryFilter")
            .field("name", &self.name)
            .field("filter_fn", &"<function>")
            .finish()
    }
}

/// Schema extension definition (used by plugins to declare their schema)
#[derive(Debug, Clone)]
pub struct SchemaExtension {
    pub entity_type: EntityType,
    pub schema_changes: Vec<SchemaChange>,
}
