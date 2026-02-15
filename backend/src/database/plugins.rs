//! Plugin management database operations

use super::common::Database;
use rusqlite::{Result, params};

impl Database {
    /// Check if a plugin is installed
    pub fn is_plugin_installed(&self, plugin_id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM installed_plugins WHERE id = ?)",
                params![plugin_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to check plugin installation: {}", e))?;
        Ok(exists)
    }

    /// Install a plugin (simple version)
    pub fn install_plugin(
        &self,
        plugin_id: &str,
        name: &str,
        version: &str,
        description: Option<&str>,
    ) -> Result<(), String> {
        self.install_plugin_with_repo(
            plugin_id,
            name,
            version,
            description,
            None,
            None,
            None,
            None,
            None,
        )
    }

    /// Install a plugin with repository URL and manifest path
    pub fn install_plugin_with_repo(
        &self,
        plugin_id: &str,
        name: &str,
        version: &str,
        description: Option<&str>,
        repository_url: Option<&str>,
        manifest_path: Option<&str>,
        frontend_entry: Option<&str>,
        frontend_components: Option<&str>,
        author: Option<&str>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let installed_at = chrono::Utc::now().timestamp();
        
        conn.execute(
            "INSERT OR REPLACE INTO installed_plugins (id, name, version, description, repository_url, manifest_path, frontend_entry, frontend_components, author, installed_at, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![plugin_id, name, version, description, repository_url, manifest_path, frontend_entry, frontend_components, author, installed_at, true],
        )
        .map_err(|e| format!("Failed to install plugin: {}", e))?;
        
        Ok(())
    }

    /// Uninstall a plugin
    pub fn uninstall_plugin(&self, plugin_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM installed_plugins WHERE id = ?",
            params![plugin_id],
        )
        .map_err(|e| format!("Failed to uninstall plugin: {}", e))?;
        
        Ok(())
    }

    /// Enable/disable a plugin
    pub fn set_plugin_enabled(&self, plugin_id: &str, enabled: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE installed_plugins SET enabled = ? WHERE id = ?",
            params![enabled, plugin_id],
        )
        .map_err(|e| format!("Failed to update plugin status: {}", e))?;
        
        Ok(())
    }

    /// Get all installed plugins
    pub fn get_installed_plugins(&self) -> Result<Vec<(String, String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, bool)>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, version, description, repository_url, manifest_path, frontend_entry, frontend_components, author, enabled FROM installed_plugins")
            .map_err(|e| format!("Failed to prepare query: {}", e))?;
        
        let plugins = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, Option<String>>(7)?,
                    row.get::<_, Option<String>>(8)?,
                    row.get::<_, bool>(9)?,
                ))
            })
            .map_err(|e| format!("Failed to query plugins: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect plugins: {}", e))?;
        
        Ok(plugins)
    }

    /// Apply plugin extensions to database schema
    pub fn apply_plugin_extensions(&self, extension_registry: &crate::plugin_system::extensions::ExtensionRegistry) -> Result<(), String> {
        use crate::plugin_system::extensions::{EntityType, SchemaChange, AutoTimestamp};
        
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tx = conn.unchecked_transaction().map_err(|e| format!("Failed to start transaction: {}", e))?;
        
        // First, handle CreateTable operations (these can create new tables)
        // We need to collect all CreateTable operations first
        let mut tables_to_create: std::collections::HashSet<String> = std::collections::HashSet::new();
        
        for entity_type in [EntityType::Activity, EntityType::ManualEntry, EntityType::Category] {
            let extensions = extension_registry.get_schema_extensions(entity_type);
            for extension in extensions {
                for schema_change in &extension.schema_changes {
                    if let SchemaChange::CreateTable { table, .. } = schema_change {
                        tables_to_create.insert(table.clone());
                    }
                }
            }
        }
        
        // Apply CreateTable operations
        for entity_type in [EntityType::Activity, EntityType::ManualEntry, EntityType::Category] {
            let extensions = extension_registry.get_schema_extensions(entity_type);
            for extension in extensions {
                for schema_change in &extension.schema_changes {
                    if let SchemaChange::CreateTable { table, columns } = schema_change {
                        // Check if table already exists
                        let table_exists: bool = tx.query_row(
                            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?)",
                            params![table],
                            |row| row.get(0),
                        ).unwrap_or(false);
                        
                        if !table_exists {
                            // Build CREATE TABLE SQL
                            let mut column_defs = Vec::new();
                            let mut indexes = Vec::new();
                            
                            for col in columns {
                                let mut col_def = format!("{} {}", col.name, col.column_type);
                                
                                if col.primary_key {
                                    col_def.push_str(" PRIMARY KEY AUTOINCREMENT");
                                }
                                
                                if !col.nullable {
                                    col_def.push_str(" NOT NULL");
                                }
                                
                                if let Some(default_val) = &col.default {
                                    col_def.push_str(&format!(" DEFAULT {}", default_val));
                                }
                                
                                if let Some(fk) = &col.foreign_key {
                                    col_def.push_str(&format!(" REFERENCES {}({})", fk.table, fk.column));
                                }
                                
                                column_defs.push(col_def);
                                
                                // Track foreign keys for index creation
                                if col.foreign_key.is_some() {
                                    indexes.push(format!("CREATE INDEX IF NOT EXISTS idx_{}_{} ON {}({})", 
                                        table, col.name, table, col.name));
                                }
                            }
                            
                            let create_sql = format!(
                                "CREATE TABLE IF NOT EXISTS {} ({})",
                                table,
                                column_defs.join(", ")
                            );
                            
                            tx.execute(&create_sql, [])
                                .map_err(|e| format!("Failed to create table {}: {}", table, e))?;
                            
                            // Create indexes for foreign keys
                            for index_sql in indexes {
                                tx.execute(&index_sql, []).ok();
                            }

                            // Record auto-timestamp columns for this table
                            let created_col: Option<String> = columns
                                .iter()
                                .find(|c| c.auto_timestamp.as_ref() == Some(&AutoTimestamp::Created))
                                .map(|c| c.name.clone());
                            let updated_col: Option<String> = columns
                                .iter()
                                .find(|c| c.auto_timestamp.as_ref() == Some(&AutoTimestamp::Updated))
                                .map(|c| c.name.clone());
                            if created_col.is_some() || updated_col.is_some() {
                                let _ = tx.execute(
                                    "INSERT OR REPLACE INTO plugin_auto_timestamps (table_name, created_at_col, updated_at_col) VALUES (?, ?, ?)",
                                    params![table, created_col, updated_col],
                                );
                            }
                        }
                    }
                }
            }
        }
        
        // Apply schema extensions for all entity types (AddColumn, AddIndex, AddForeignKey)
        for entity_type in [EntityType::Activity, EntityType::ManualEntry, EntityType::Category] {
            let extensions = extension_registry.get_schema_extensions(entity_type);
            
            for extension in extensions {
                for schema_change in &extension.schema_changes {
                    match schema_change {
                        SchemaChange::CreateTable { .. } => {
                            // Already handled above, skip
                            continue;
                        }
                        SchemaChange::AddColumn { table, column, column_type, default, foreign_key } => {
                            // Check if column already exists
                            let column_exists: bool = tx.query_row(
                                "SELECT EXISTS(SELECT 1 FROM pragma_table_info(?) WHERE name = ?)",
                                params![table, column],
                                |row| row.get(0),
                            ).unwrap_or(false);
                            
                            if !column_exists {
                                let mut sql = format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, column_type);
                                
                                if let Some(default_val) = default {
                                    sql.push_str(&format!(" DEFAULT {}", default_val));
                                }
                                
                                tx.execute(&sql, [])
                                    .map_err(|e| format!("Failed to add column {} to {}: {}", column, table, e))?;
                                
                                // Add foreign key constraint if specified
                                if foreign_key.is_some() {
                                    // SQLite doesn't support adding foreign keys via ALTER TABLE ADD COLUMN
                                    // Foreign keys are checked at runtime if foreign keys are enabled
                                    // We'll create an index for performance
                                    let index_name = format!("idx_{}_{}", table, column);
                                    let index_sql = format!(
                                        "CREATE INDEX IF NOT EXISTS {} ON {}({})",
                                        index_name, table, column
                                    );
                                    tx.execute(&index_sql, []).ok();
                                }
                            }
                        }
                        SchemaChange::AddIndex { table, index, columns } => {
                            let columns_str = columns.join(", ");
                            let sql = format!("CREATE INDEX IF NOT EXISTS {} ON {}({})", index, table, columns_str);
                            tx.execute(&sql, [])
                                .map_err(|e| format!("Failed to create index {}: {}", index, e))?;
                        }
                        SchemaChange::AddForeignKey { table, column, foreign_table: _, foreign_column: _ } => {
                            // SQLite doesn't support adding foreign keys after table creation
                            // We'll just create an index for performance
                            let index_name = format!("idx_{}_{}_fk", table, column);
                            let sql = format!(
                                "CREATE INDEX IF NOT EXISTS {} ON {}({})",
                                index_name, table, column
                            );
                            tx.execute(&sql, []).ok();
                        }
                    }
                }
            }
        }
        
        tx.commit().map_err(|e| format!("Failed to commit transaction: {}", e))?;
        Ok(())
    }
}
