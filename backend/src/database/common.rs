//! Common database utilities, constants, and schema initialization

use rusqlite::{Connection, Result, params};
use std::path::PathBuf;
use std::sync::Mutex;

/// Latest schema version; new installs get this without running migrations.
const LATEST_SCHEMA_VERSION: i64 = 13;

/// System category IDs (negative to avoid conflicts with regular categories)
pub const SYSTEM_CATEGORY_UNCATEGORIZED: i64 = -1;
pub const SYSTEM_CATEGORY_BREAK: i64 = -2;
pub const SYSTEM_CATEGORY_THINKING: i64 = -3;

/// Database wrapper
pub struct Database {
    pub(crate) conn: Mutex<Connection>,
}

impl Database {
    /// Create a new database connection
    pub fn new(path: PathBuf) -> Result<Self> {
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(&path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init()?;
        Ok(db)
    }

    /// Initialize the database schema
    pub(crate) fn init(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Create tables
        conn.execute_batch(r#"
            -- Activities table
            CREATE TABLE IF NOT EXISTS activities (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                app_name TEXT NOT NULL,
                window_title TEXT,
                domain TEXT,
                category_id INTEGER,
                started_at INTEGER NOT NULL,
                duration_sec INTEGER NOT NULL,
                is_idle BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            );

            CREATE INDEX IF NOT EXISTS idx_activities_started ON activities(started_at);
            CREATE INDEX IF NOT EXISTS idx_activities_app ON activities(app_name);
            CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category_id);
            CREATE INDEX IF NOT EXISTS idx_activities_app_category ON activities(app_name, category_id);
            CREATE INDEX IF NOT EXISTS idx_activities_domain ON activities(domain);

            -- Categories table
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT DEFAULT '#888888',
                icon TEXT,
                is_productive BOOLEAN DEFAULT TRUE,
                sort_order INTEGER DEFAULT 0,
                is_system BOOLEAN DEFAULT FALSE,
                is_pinned BOOLEAN DEFAULT FALSE
            );

            -- Rules table
            CREATE TABLE IF NOT EXISTS rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_type TEXT NOT NULL,
                pattern TEXT NOT NULL,
                category_id INTEGER NOT NULL,
                priority INTEGER DEFAULT 0,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            );

            -- Manual entries table
            CREATE TABLE IF NOT EXISTS manual_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_type TEXT NOT NULL,
                description TEXT,
                category_id INTEGER,
                started_at INTEGER NOT NULL,
                ended_at INTEGER NOT NULL,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            );

            CREATE INDEX IF NOT EXISTS idx_manual_entries_started ON manual_entries(started_at);

            -- Settings table
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            -- Installed plugins table
            CREATE TABLE IF NOT EXISTS installed_plugins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                version TEXT NOT NULL,
                description TEXT,
                repository_url TEXT,
                manifest_path TEXT,
                frontend_entry TEXT,
                frontend_components TEXT,
                author TEXT,
                installed_at INTEGER NOT NULL,
                enabled BOOLEAN DEFAULT TRUE
            );
        "#)?;

        // Check if this is a fresh install or existing database
        let existing_version: Option<i64> = conn
            .query_row(
                "SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'schema_version'",
                [],
                |row| row.get(0),
            )
            .ok();

        match existing_version {
            None => {
                // Fresh install -- schema is already at latest, just record version
                conn.execute(
                    "INSERT INTO settings (key, value) VALUES ('schema_version', ?)",
                    params![LATEST_SCHEMA_VERSION],
                )?;
            }
            Some(_) => {
                // Existing database -- run incremental migrations
                self.migrate(&conn)?;
            }
        }

        // Check if default data has already been initialized
        let default_data_initialized: bool = conn.query_row(
            "SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'default_data_initialized'",
            [],
            |row| row.get(0),
        ).unwrap_or(false);

        // Only create default categories and rules on first run
        if !default_data_initialized {
            // Insert default categories
            conn.execute_batch(r#"
                INSERT OR IGNORE INTO categories (name, color, icon, is_productive, sort_order, is_system, is_pinned) VALUES
                    ('Work', '#4CAF50', '💼', TRUE, 1, FALSE, FALSE),
                    ('Communication', '#2196F3', '💬', TRUE, 2, FALSE, TRUE),
                    ('Meetings', '#9C27B0', '🎥', TRUE, 3, FALSE, TRUE),
                    ('Browser', '#FF9800', '🌐', NULL, 4, FALSE, FALSE),
                    ('Entertainment', '#F44336', '🎮', FALSE, 5, FALSE, FALSE),
                    ('Personal', '#9E9E9E', '🏠', FALSE, 9, FALSE, TRUE);
            "#)?;
            
            // System categories use negative IDs to avoid conflicts with regular categories
            for (id, name, color, icon, is_productive, sort_order, is_pinned) in [
                (-1, "Uncategorized", "#9E9E9E", "❓", None::<bool>, 8, false),
                (-2, "Break", "#795548", "☕", Some(false), 7, true),
                (-3, "Thinking", "#00BCD4", "🧠", Some(true), 6, true),
            ] {
                // Check if system category already exists (might exist from migrations)
                let exists_by_id: bool = conn.query_row(
                    "SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)",
                    params![id],
                    |row| row.get(0),
                ).unwrap_or(false);
                
                if !exists_by_id {
                    conn.execute(
                        "INSERT INTO categories (id, name, color, icon, is_productive, sort_order, is_system, is_pinned) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)",
                        params![id, name, color, icon, is_productive, sort_order, is_pinned],
                    )?;
                }
            }

            // Insert default rules
            let default_rules = vec![
                ("app_name", "Code", "Work", 10),
                ("app_name", "Visual Studio", "Work", 10),
                ("app_name", "IntelliJ", "Work", 10),
                ("app_name", "WebStorm", "Work", 10),
                ("app_name", "PyCharm", "Work", 10),
                ("app_name", "Slack", "Communication", 10),
                ("app_name", "Discord", "Communication", 10),
                ("app_name", "Microsoft Teams", "Communication", 10),
                ("app_name", "Telegram", "Communication", 10),
                ("app_name", "Zoom", "Meetings", 10),
                ("app_name", "Google Meet", "Meetings", 10),
                ("app_name", "Chrome", "Browser", 5),
                ("app_name", "Firefox", "Browser", 5),
                ("app_name", "Safari", "Browser", 5),
                ("app_name", "Edge", "Browser", 5),
                ("window_title", "*YouTube*", "Entertainment", 15),
                ("window_title", "*Netflix*", "Entertainment", 15),
                ("window_title", "*Twitch*", "Entertainment", 15),
            ];

            for (rule_type, pattern, category_name, priority) in default_rules {
                let _ = conn.execute(
                    "INSERT INTO rules (rule_type, pattern, category_id, priority)
                     SELECT ?, ?, id, ?
                     FROM categories
                     WHERE name = ?",
                    params![rule_type, pattern, priority, category_name],
                );
            }

            // Mark default data as initialized
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES ('default_data_initialized', '1')",
                [],
            )?;
        } else {
            // For existing databases, ensure system categories exist (but don't overwrite user changes)
            for (id, name, color, icon, is_productive, sort_order, is_pinned) in [
                (-1, "Uncategorized", "#9E9E9E", "❓", None::<bool>, 8, false),
                (-2, "Break", "#795548", "☕", Some(false), 7, true),
                (-3, "Thinking", "#00BCD4", "🧠", Some(true), 6, true),
            ] {
                let exists_by_id: bool = conn.query_row(
                    "SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)",
                    params![id],
                    |row| row.get(0),
                ).unwrap_or(false);
                
                if !exists_by_id {
                    let _ = conn.execute(
                        "INSERT INTO categories (id, name, color, icon, is_productive, sort_order, is_system, is_pinned) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)",
                        params![id, name, color, icon, is_productive, sort_order, is_pinned],
                    );
                }
            }
        }

        Ok(())
    }

    fn get_schema_version(&self, conn: &Connection) -> i64 {
        conn.query_row(
            "SELECT CAST(value AS INTEGER) FROM settings WHERE key = 'schema_version'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0)
    }

    /// Run database migrations
    pub(crate) fn migrate(&self, conn: &Connection) -> Result<()> {
        let version = self.get_schema_version(conn);

        if version < 1  { self.migrate_v1(conn)?; }
        if version < 2  { self.migrate_v2(conn)?; }
        if version < 3  { self.migrate_v3(conn)?; }
        if version < 4  { self.migrate_v4(conn)?; }
        if version < 5  { self.migrate_v5(conn)?; }
        if version < 6  { self.migrate_v6(conn)?; }
        if version < 7  { self.migrate_v7(conn)?; }
        if version < 8  { self.migrate_v8(conn)?; }
        if version < 9  { self.migrate_v9(conn)?; }
        if version < 10 { self.migrate_v10(conn)?; }
        if version < 11 { self.migrate_v11(conn)?; }
        if version < 12 { self.migrate_v12(conn)?; }
        if version < 13 { self.migrate_v13(conn)?; }

        Ok(())
    }

    fn migrate_v13(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "CREATE TABLE IF NOT EXISTS plugin_auto_timestamps (
                table_name TEXT PRIMARY KEY,
                created_at_col TEXT,
                updated_at_col TEXT
            )",
            [],
        )?;
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '13')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v11(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_activities_started_at_is_idle ON activities(started_at, is_idle)",
            [],
        )?;
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '11')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    /// Check if a column exists in a table
    fn column_exists(conn: &Connection, table: &str, column: &str) -> bool {
        let query = format!("PRAGMA table_info({})", table);
        let mut stmt = match conn.prepare(&query) {
            Ok(s) => s,
            Err(_) => return false,
        };
        let rows = match stmt.query_map([], |row| {
            Ok(row.get::<_, String>(1)?)
        }) {
            Ok(r) => r,
            Err(_) => return false,
        };
        for row in rows {
            if let Ok(col_name) = row {
                if col_name == column {
                    return true;
                }
            }
        }
        false
    }

    fn migrate_v12(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        
        // Migrate installed_plugins table to latest structure
        if Self::column_exists(conn, "installed_plugins", "is_builtin") {
            tx.execute_batch(r#"
                CREATE TABLE installed_plugins_new (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    version TEXT NOT NULL,
                    description TEXT,
                    repository_url TEXT,
                    manifest_path TEXT,
                    installed_at INTEGER NOT NULL,
                    enabled BOOLEAN DEFAULT TRUE
                );
                INSERT INTO installed_plugins_new (id, name, version, description, repository_url, manifest_path, installed_at, enabled)
                SELECT id, name, version, description, repository_url, manifest_path, installed_at, enabled
                FROM installed_plugins;
                DROP TABLE installed_plugins;
                ALTER TABLE installed_plugins_new RENAME TO installed_plugins;
            "#)?;
        }
        
        // Add missing columns if they don't exist
        if !Self::column_exists(conn, "installed_plugins", "repository_url") {
            let _ = tx.execute("ALTER TABLE installed_plugins ADD COLUMN repository_url TEXT", []);
        }
        if !Self::column_exists(conn, "installed_plugins", "manifest_path") {
            let _ = tx.execute("ALTER TABLE installed_plugins ADD COLUMN manifest_path TEXT", []);
        }
        if !Self::column_exists(conn, "installed_plugins", "frontend_entry") {
            let _ = tx.execute("ALTER TABLE installed_plugins ADD COLUMN frontend_entry TEXT", []);
        }
        if !Self::column_exists(conn, "installed_plugins", "frontend_components") {
            let _ = tx.execute("ALTER TABLE installed_plugins ADD COLUMN frontend_components TEXT", []);
        }
        if !Self::column_exists(conn, "installed_plugins", "author") {
            let _ = tx.execute("ALTER TABLE installed_plugins ADD COLUMN author TEXT", []);
        }
        
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '12')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v1(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        let _ = tx.execute("ALTER TABLE activities ADD COLUMN domain TEXT", []);
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '1')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v2(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '2')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v3(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        let _ = tx.execute("CREATE INDEX IF NOT EXISTS idx_activities_domain ON activities(domain)", []);
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '3')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v4(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '4')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v5(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '5')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v6(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        let _ = tx.execute_batch(r#"
                DELETE FROM rules
                WHERE id NOT IN (
                    SELECT MIN(id)
                    FROM rules
                    GROUP BY rule_type, pattern, category_id
                );
            "#);
        let _ = tx.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_rules_unique ON rules(rule_type, pattern, category_id)",
            [],
        );
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '6')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v7(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        let _ = tx.execute("ALTER TABLE categories ADD COLUMN is_system BOOLEAN DEFAULT FALSE", []);
        let _ = tx.execute("ALTER TABLE categories ADD COLUMN is_pinned BOOLEAN DEFAULT FALSE", []);
        let _ = tx.execute(
            "UPDATE categories SET is_system = TRUE WHERE name IN ('Thinking', 'Break', 'Uncategorized')",
            [],
        );
        let _ = tx.execute(
            "UPDATE categories SET is_pinned = TRUE WHERE name IN ('Thinking', 'Break', 'Meetings', 'Communication', 'Personal')",
            [],
        );
        let _ = tx.execute(
            "INSERT OR IGNORE INTO categories (name, color, icon, is_productive, sort_order, is_system, is_pinned) 
             VALUES ('Personal', '#9E9E9E', '🏠', FALSE, 9, FALSE, TRUE)",
            [],
        );
        let thinking_id: Option<i64> = tx.query_row("SELECT id FROM categories WHERE name = 'Thinking'", [], |row| row.get(0)).ok();
        let break_id: Option<i64> = tx.query_row("SELECT id FROM categories WHERE name = 'Break'", [], |row| row.get(0)).ok();
        let meetings_id: Option<i64> = tx.query_row("SELECT id FROM categories WHERE name = 'Meetings'", [], |row| row.get(0)).ok();
        let communication_id: Option<i64> = tx.query_row("SELECT id FROM categories WHERE name = 'Communication'", [], |row| row.get(0)).ok();
        let personal_id: Option<i64> = tx.query_row("SELECT id FROM categories WHERE name = 'Personal'", [], |row| row.get(0)).ok();
        if let Some(id) = thinking_id {
            let _ = tx.execute(
                "UPDATE manual_entries SET category_id = ? WHERE entry_type = 'thinking' AND category_id IS NULL",
                params![id],
            );
        }
        if let Some(id) = break_id {
            let _ = tx.execute(
                "UPDATE manual_entries SET category_id = ? WHERE entry_type = 'break' AND category_id IS NULL",
                params![id],
            );
        }
        if let Some(id) = meetings_id {
            let _ = tx.execute(
                "UPDATE manual_entries SET category_id = ? WHERE entry_type = 'meeting' AND category_id IS NULL",
                params![id],
            );
        }
        if let Some(id) = communication_id {
            let _ = tx.execute(
                "UPDATE manual_entries SET category_id = ? WHERE entry_type = 'call' AND category_id IS NULL",
                params![id],
            );
        }
        if let Some(id) = personal_id {
            let _ = tx.execute(
                "UPDATE manual_entries SET category_id = ? WHERE entry_type = 'personal' AND category_id IS NULL",
                params![id],
            );
        }
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '7')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v8(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '8')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v9(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '9')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v10(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        let uncategorized_id: Option<i64> = tx.query_row(
            "SELECT id FROM categories WHERE name = 'Uncategorized' AND is_system = TRUE",
            [],
            |row| row.get(0),
        ).ok();
        let break_id: Option<i64> = tx.query_row(
            "SELECT id FROM categories WHERE name = 'Break' AND is_system = TRUE",
            [],
            |row| row.get(0),
        ).ok();
        let thinking_id: Option<i64> = tx.query_row(
            "SELECT id FROM categories WHERE name = 'Thinking' AND is_system = TRUE",
            [],
            |row| row.get(0),
        ).ok();
        if let Some(old_id) = uncategorized_id {
            if old_id != SYSTEM_CATEGORY_UNCATEGORIZED {
                let _ = tx.execute(
                    "UPDATE activities SET category_id = ? WHERE category_id = ?",
                    params![SYSTEM_CATEGORY_UNCATEGORIZED, old_id],
                );
                let _ = tx.execute(
                    "UPDATE manual_entries SET category_id = ? WHERE category_id = ?",
                    params![SYSTEM_CATEGORY_UNCATEGORIZED, old_id],
                );
                let _ = tx.execute(
                    "UPDATE rules SET category_id = ? WHERE category_id = ?",
                    params![SYSTEM_CATEGORY_UNCATEGORIZED, old_id],
                );
                let _ = tx.execute("DELETE FROM categories WHERE id = ?", params![old_id]);
            }
        }
        if let Some(old_id) = break_id {
            if old_id != SYSTEM_CATEGORY_BREAK {
                let _ = tx.execute(
                    "UPDATE activities SET category_id = ? WHERE category_id = ?",
                    params![SYSTEM_CATEGORY_BREAK, old_id],
                );
                let _ = tx.execute(
                    "UPDATE manual_entries SET category_id = ? WHERE category_id = ?",
                    params![SYSTEM_CATEGORY_BREAK, old_id],
                );
                let _ = tx.execute(
                    "UPDATE rules SET category_id = ? WHERE category_id = ?",
                    params![SYSTEM_CATEGORY_BREAK, old_id],
                );
                let _ = tx.execute("DELETE FROM categories WHERE id = ?", params![old_id]);
            }
        }
        if let Some(old_id) = thinking_id {
            if old_id != SYSTEM_CATEGORY_THINKING {
                let _ = tx.execute(
                    "UPDATE activities SET category_id = ? WHERE category_id = ?",
                    params![SYSTEM_CATEGORY_THINKING, old_id],
                );
                let _ = tx.execute(
                    "UPDATE manual_entries SET category_id = ? WHERE category_id = ?",
                    params![SYSTEM_CATEGORY_THINKING, old_id],
                );
                let _ = tx.execute(
                    "UPDATE rules SET category_id = ? WHERE category_id = ?",
                    params![SYSTEM_CATEGORY_THINKING, old_id],
                );
                let _ = tx.execute("DELETE FROM categories WHERE id = ?", params![old_id]);
            }
        }
        tx.execute_batch(r#"
            INSERT OR IGNORE INTO categories (id, name, color, icon, is_productive, sort_order, is_system, is_pinned) VALUES
                (-1, 'Uncategorized', '#9E9E9E', '❓', NULL, 8, TRUE, FALSE),
                (-2, 'Break', '#795548', '☕', FALSE, 7, TRUE, TRUE),
                (-3, 'Thinking', '#00BCD4', '🧠', TRUE, 6, TRUE, TRUE);
        "#)?;
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '10')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }
}

// Extension trait for optional query results
pub(crate) trait OptionalExtension<T> {
    fn optional(self) -> Result<Option<T>>;
}

impl<T> OptionalExtension<T> for Result<T> {
    fn optional(self) -> Result<Option<T>> {
        match self {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}
