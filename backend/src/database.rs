//! Database module for SQLite operations

use rusqlite::{Connection, Result, params};
use std::path::PathBuf;
use std::sync::Mutex;
use chrono::{Utc, Local, Duration, NaiveDate, Datelike};

/// Latest schema version; new installs get this without running migrations.
const LATEST_SCHEMA_VERSION: i64 = 11;

/// System category IDs (negative to avoid conflicts with regular categories)
pub const SYSTEM_CATEGORY_UNCATEGORIZED: i64 = -1;
pub const SYSTEM_CATEGORY_BREAK: i64 = -2;
pub const SYSTEM_CATEGORY_THINKING: i64 = -3;

/// Activity record from the database
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Activity {
    pub id: i64,
    pub app_name: String,
    pub window_title: Option<String>,
    pub domain: Option<String>,
    pub category_id: Option<i64>,
    pub project_id: Option<i64>,
    pub task_id: Option<i64>,
    pub started_at: i64,
    pub duration_sec: i64,
    pub is_idle: bool,
}

/// Category record
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub icon: Option<String>,
    pub is_productive: Option<bool>,
    pub is_billable: Option<bool>,
    pub hourly_rate: Option<f64>,
    pub sort_order: i64,
    pub is_system: bool,
    pub is_pinned: bool,
    pub project_id: Option<i64>,
    pub task_id: Option<i64>,
}

/// Rule for auto-categorization
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Rule {
    pub id: i64,
    pub rule_type: String,
    pub pattern: String,
    pub category_id: i64,
    pub priority: i64,
}

/// Manual entry record
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ManualEntry {
    pub id: i64,
    pub description: Option<String>,
    pub category_id: Option<i64>,
    pub project: Option<String>, // Legacy field, kept for backward compatibility
    pub project_id: Option<i64>,
    pub task_id: Option<i64>,
    pub started_at: i64,
    pub ended_at: i64,
}

/// Database wrapper
pub struct Database {
    conn: Mutex<Connection>,
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
    fn init(&self) -> Result<()> {
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
                project_id INTEGER,
                task_id INTEGER,
                started_at INTEGER NOT NULL,
                duration_sec INTEGER NOT NULL,
                is_idle BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (category_id) REFERENCES categories(id),
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (task_id) REFERENCES tasks(id)
            );

            CREATE INDEX IF NOT EXISTS idx_activities_started ON activities(started_at);
            CREATE INDEX IF NOT EXISTS idx_activities_app ON activities(app_name);
            CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category_id);
            CREATE INDEX IF NOT EXISTS idx_activities_app_category ON activities(app_name, category_id);
            CREATE INDEX IF NOT EXISTS idx_activities_domain ON activities(domain);
            CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);

            -- Categories table
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                color TEXT DEFAULT '#888888',
                icon TEXT,
                is_productive BOOLEAN DEFAULT TRUE,
                is_billable BOOLEAN DEFAULT FALSE,
                hourly_rate REAL DEFAULT 0.0,
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
                project TEXT,
                project_id INTEGER,
                task_id INTEGER,
                started_at INTEGER NOT NULL,
                ended_at INTEGER NOT NULL,
                FOREIGN KEY (category_id) REFERENCES categories(id),
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (task_id) REFERENCES tasks(id)
            );

            CREATE INDEX IF NOT EXISTS idx_manual_entries_started ON manual_entries(started_at);

            -- Projects table
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                client_name TEXT,
                color TEXT DEFAULT '#888888',
                is_billable BOOLEAN DEFAULT FALSE,
                hourly_rate REAL DEFAULT 0.0,
                budget_hours REAL,
                created_at INTEGER NOT NULL,
                archived BOOLEAN DEFAULT FALSE
            );

            CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived);

            -- Tasks table
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at INTEGER NOT NULL,
                archived BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived);

            -- Focus sessions table
            CREATE TABLE IF NOT EXISTS focus_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at INTEGER NOT NULL,
                ended_at INTEGER,
                duration_sec INTEGER,
                pomodoro_type TEXT DEFAULT 'work',
                project_id INTEGER,
                task_id INTEGER,
                completed BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (task_id) REFERENCES tasks(id)
            );

            CREATE INDEX IF NOT EXISTS idx_focus_sessions_started ON focus_sessions(started_at);

            -- Goals table
            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_type TEXT NOT NULL,
                target_seconds INTEGER NOT NULL,
                category_id INTEGER,
                project_id INTEGER,
                start_date INTEGER NOT NULL,
                end_date INTEGER,
                created_at INTEGER NOT NULL,
                active BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (category_id) REFERENCES categories(id),
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );

            CREATE INDEX IF NOT EXISTS idx_goals_active ON goals(active);
            CREATE INDEX IF NOT EXISTS idx_goals_type ON goals(goal_type);

            -- Settings table
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
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

        // Insert default categories if not exist
        // Regular categories use AUTOINCREMENT (no id specified)
        // For fresh installs, these will always be inserted since no categories exist yet
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
        // Ensure system categories exist - check by name to handle cases where category exists with different ID
        for (id, name, color, icon, is_productive, sort_order, is_pinned) in [
            (-1, "Uncategorized", "#9E9E9E", "❓", None::<bool>, 8, false),
            (-2, "Break", "#795548", "☕", Some(false), 7, true),
            (-3, "Thinking", "#00BCD4", "🧠", Some(true), 6, true),
        ] {
            // Check if category exists by ID
            let exists_by_id: bool = conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)",
                params![id],
                |row| row.get(0),
            ).unwrap_or(false);
            
            // Check if category exists by name (might have different ID)
            let existing_id: Option<i64> = conn.query_row(
                "SELECT id FROM categories WHERE name = ?",
                params![name],
                |row| row.get(0),
            ).ok();
            
            if exists_by_id {
                // Category already exists with correct ID, ensure it has correct system properties
                // Include name in UPDATE to fix any leftover temp names from failed migrations
                let _ = conn.execute(
                    "UPDATE categories SET name = ?, color = ?, icon = ?, is_productive = ?, sort_order = ?, is_system = TRUE, is_pinned = ? WHERE id = ?",
                    params![name, color, icon, is_productive, sort_order, is_pinned, id],
                );
            } else if let Some(existing_id_val) = existing_id {
                // Category exists with different ID - we need to migrate it to the system ID
                // Strategy: Create the target category with a temporary unique name first,
                // update all foreign key references, then delete the old category and rename the new one
                
                // Step 1: Create the target category with a temporary unique name
                let temp_name = format!("__TEMP_SYSTEM_{}_{}", id, chrono::Utc::now().timestamp());
                conn.execute(
                    "INSERT INTO categories (id, name, color, icon, is_productive, sort_order, is_system, is_pinned) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)",
                    params![id, temp_name, color, icon, is_productive, sort_order, is_pinned],
                )?;
                
                // Step 2: Update all foreign key references to point to the new system ID
                let _ = conn.execute(
                    "UPDATE activities SET category_id = ? WHERE category_id = ?",
                    params![id, existing_id_val],
                );
                let _ = conn.execute(
                    "UPDATE manual_entries SET category_id = ? WHERE category_id = ?",
                    params![id, existing_id_val],
                );
                let _ = conn.execute(
                    "UPDATE rules SET category_id = ? WHERE category_id = ?",
                    params![id, existing_id_val],
                );
                let _ = conn.execute(
                    "UPDATE goals SET category_id = ? WHERE category_id = ?",
                    params![id, existing_id_val],
                );
                
                // Step 3: Now delete the old category (should work since all references are updated)
                conn.execute("DELETE FROM categories WHERE id = ?", params![existing_id_val])?;
                
                // Step 4: Update the temp category to have the correct name
                conn.execute(
                    "UPDATE categories SET name = ? WHERE id = ?",
                    params![name, id],
                )?;
            } else {
                // Category doesn't exist, insert it
                conn.execute(
                    "INSERT INTO categories (id, name, color, icon, is_productive, sort_order, is_system, is_pinned) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)",
                    params![id, name, color, icon, is_productive, sort_order, is_pinned],
                )?;
            }
        }

        // Insert default rules (only if they don't exist)
        // Find categories by name and insert rules only if they don't already exist
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
            // Check if rule already exists
            let exists: bool = conn.query_row(
                "SELECT EXISTS(
                    SELECT 1 FROM rules 
                    WHERE rule_type = ? AND pattern = ? AND category_id = (
                        SELECT id FROM categories WHERE name = ?
                    )
                )",
                params![rule_type, pattern, category_name],
                |row| row.get(0),
            ).unwrap_or(false);

            if !exists {
                // Insert rule if category exists
                // For fresh installs, categories are inserted before rules, so this will always succeed
                // For existing databases, if category doesn't exist, no row is inserted (which is correct)
                let _ = conn.execute(
                    "INSERT INTO rules (rule_type, pattern, category_id, priority)
                     SELECT ?, ?, id, ?
                     FROM categories
                     WHERE name = ?",
                    params![rule_type, pattern, priority, category_name],
                );
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
    fn migrate(&self, conn: &Connection) -> Result<()> {
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

        Ok(())
    }

    fn migrate_v11(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_activities_started_at_is_idle ON activities(started_at, is_idle)",
            [],
        )?;
        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_focus_sessions_ended_at ON focus_sessions(ended_at)",
            [],
        )?;
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '11')",
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
        let _ = tx.execute("ALTER TABLE categories ADD COLUMN is_billable BOOLEAN DEFAULT FALSE", []);
        let _ = tx.execute("ALTER TABLE categories ADD COLUMN hourly_rate REAL DEFAULT 0.0", []);
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '2')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v3(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        let _ = tx.execute_batch(r#"
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                client_name TEXT,
                color TEXT DEFAULT '#888888',
                is_billable BOOLEAN DEFAULT FALSE,
                hourly_rate REAL DEFAULT 0.0,
                budget_hours REAL,
                created_at INTEGER NOT NULL,
                archived BOOLEAN DEFAULT FALSE
            );
            CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived);
        "#);
        let _ = tx.execute_batch(r#"
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at INTEGER NOT NULL,
                archived BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived);
        "#);
        let _ = tx.execute("ALTER TABLE activities ADD COLUMN project_id INTEGER", []);
        let _ = tx.execute("ALTER TABLE activities ADD COLUMN task_id INTEGER", []);
        let _ = tx.execute("ALTER TABLE manual_entries ADD COLUMN project_id INTEGER", []);
        let _ = tx.execute("ALTER TABLE manual_entries ADD COLUMN task_id INTEGER", []);
        let _ = tx.execute("CREATE INDEX IF NOT EXISTS idx_activities_domain ON activities(domain)", []);
        let _ = tx.execute("CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id)", []);
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '3')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v4(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        let _ = tx.execute_batch(r#"
            CREATE TABLE IF NOT EXISTS focus_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at INTEGER NOT NULL,
                ended_at INTEGER,
                duration_sec INTEGER,
                pomodoro_type TEXT DEFAULT 'work',
                project_id INTEGER,
                task_id INTEGER,
                completed BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (task_id) REFERENCES tasks(id)
            );
            CREATE INDEX IF NOT EXISTS idx_focus_sessions_started ON focus_sessions(started_at);
        "#);
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '4')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v5(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        let _ = tx.execute_batch(r#"
            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goal_type TEXT NOT NULL,
                target_seconds INTEGER NOT NULL,
                category_id INTEGER,
                project_id INTEGER,
                start_date INTEGER NOT NULL,
                end_date INTEGER,
                created_at INTEGER NOT NULL,
                active BOOLEAN DEFAULT TRUE,
                FOREIGN KEY (category_id) REFERENCES categories(id),
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );
            CREATE INDEX IF NOT EXISTS idx_goals_active ON goals(active);
            CREATE INDEX IF NOT EXISTS idx_goals_type ON goals(goal_type);
        "#);
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
            "INSERT OR IGNORE INTO categories (name, color, icon, is_productive, is_billable, hourly_rate, sort_order, is_system, is_pinned) 
             VALUES ('Personal', '#9E9E9E', '🏠', FALSE, FALSE, 0.0, 9, FALSE, TRUE)",
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
        let _ = tx.execute("ALTER TABLE categories ADD COLUMN project_id INTEGER", []);
        let _ = tx.execute("ALTER TABLE categories ADD COLUMN task_id INTEGER", []);
        let _ = tx.execute("CREATE INDEX IF NOT EXISTS idx_categories_project ON categories(project_id)", []);
        let _ = tx.execute("CREATE INDEX IF NOT EXISTS idx_categories_task ON categories(task_id)", []);
        tx.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '8')",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    fn migrate_v9(&self, conn: &Connection) -> Result<()> {
        let tx = conn.unchecked_transaction()?;
        let _ = tx.execute("ALTER TABLE goals ADD COLUMN name TEXT", []);
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
                let _ = tx.execute(
                    "UPDATE goals SET category_id = ? WHERE category_id = ?",
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
                let _ = tx.execute(
                    "UPDATE goals SET category_id = ? WHERE category_id = ?",
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
                let _ = tx.execute(
                    "UPDATE goals SET category_id = ? WHERE category_id = ?",
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

    /// Insert or update an activity record
    pub fn upsert_activity(
        &self,
        app_name: &str,
        window_title: Option<&str>,
        domain: Option<&str>,
        timestamp: i64,
        project_id: Option<i64>,
        task_id: Option<i64>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Try to find matching category
        let category_id = self.find_category_for_activity(&conn, app_name, window_title, domain);

        // Get project_id and task_id from category if available, otherwise use provided values
        // Priority: category.project_id > active_project_id > None
        let final_project_id = if let Some(cat_id) = category_id {
            // Try to get project_id from category
            match conn.query_row::<Option<i64>, _, _>(
                "SELECT project_id FROM categories WHERE id = ?",
                params![cat_id],
                |row| row.get(0),
            ) {
                Ok(cat_project_id) => {
                    if cat_project_id.is_some() {
                        cat_project_id
                    } else {
                        project_id
                    }
                }
                Err(_) => project_id,
            }
        } else {
            project_id
        };

        let final_task_id = if let Some(cat_id) = category_id {
            // Try to get task_id from category
            match conn.query_row::<Option<i64>, _, _>(
                "SELECT task_id FROM categories WHERE id = ?",
                params![cat_id],
                |row| row.get(0),
            ) {
                Ok(cat_task_id) => {
                    if cat_task_id.is_some() {
                        cat_task_id
                    } else {
                        task_id
                    }
                }
                Err(_) => task_id,
            }
        } else {
            task_id
        };

        // Check if there's a recent activity for the same app and window title (within 5 minutes)
        // Match by app_name and window_title if available, or just app_name if window_title is None
        let existing: Option<(i64, i64, i64)> = if let Some(title) = window_title {
            conn.query_row(
                "SELECT id, duration_sec, started_at FROM activities 
                 WHERE app_name = ? AND window_title = ? AND started_at > ? - 300 
                 ORDER BY started_at DESC LIMIT 1",
                params![app_name, title, timestamp],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .ok()
        } else {
            conn.query_row(
                "SELECT id, duration_sec, started_at FROM activities 
                 WHERE app_name = ? AND window_title IS NULL AND started_at > ? - 300 
                 ORDER BY started_at DESC LIMIT 1",
                params![app_name, timestamp],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .ok()
        };

        if let Some((id, duration, started_at)) = existing {
            // Calculate actual duration based on time difference since start
            // The duration should be the time elapsed since the activity started
            let time_diff = timestamp - started_at;
            // Use the maximum of: stored duration + 5 seconds (polling interval) or calculated time difference
            // This ensures duration grows correctly even if updates are missed
            let new_duration = std::cmp::max(duration + 5, time_diff);
            
            // Update existing record, also update category in case rules changed
            // Also update project_id and task_id in case category changed
            conn.execute(
                "UPDATE activities SET duration_sec = ?, category_id = ?, project_id = ?, task_id = ? WHERE id = ?",
                params![new_duration, category_id, final_project_id, final_task_id, id],
            )?;
        } else {
            // Insert new record with initial duration of 5 seconds
            conn.execute(
                "INSERT INTO activities (app_name, window_title, domain, category_id, project_id, task_id, started_at, duration_sec, is_idle)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 5, FALSE)",
                params![app_name, window_title, domain, category_id, final_project_id, final_task_id, timestamp],
            )?;
        }

        Ok(())
    }

    /// Find category for an activity based on rules
    fn find_category_for_activity(
        &self,
        conn: &Connection,
        app_name: &str,
        window_title: Option<&str>,
        domain: Option<&str>,
    ) -> Option<i64> {
        // Get rules ordered by priority
        let mut stmt = conn
            .prepare("SELECT rule_type, pattern, category_id FROM rules ORDER BY priority DESC")
            .ok()?;

        let rules = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            })
            .ok()?;

        for rule in rules.flatten() {
            let (rule_type, pattern, category_id) = rule;
            let matches = match rule_type.as_str() {
                "app_name" => {
                    let app_lower = app_name.to_lowercase();
                    let pattern_lower = pattern.to_lowercase();
                    
                    // Handle wildcard patterns
                    if pattern_lower.starts_with('*') && pattern_lower.ends_with('*') {
                        // *pattern* - contains
                        let pattern_clean = pattern_lower.trim_start_matches('*').trim_end_matches('*');
                        app_lower.contains(&pattern_clean)
                    } else if pattern_lower.starts_with('*') {
                        // *pattern - ends with
                        let pattern_clean = pattern_lower.trim_start_matches('*');
                        app_lower.ends_with(&pattern_clean)
                    } else if pattern_lower.ends_with('*') {
                        // pattern* - starts with
                        let pattern_clean = pattern_lower.trim_end_matches('*');
                        app_lower.starts_with(&pattern_clean)
                    } else {
                        // No wildcard - exact match or contains
                        app_lower.contains(&pattern_lower)
                    }
                }
                "window_title" => {
                    if let Some(title) = window_title {
                        let title_lower = title.to_lowercase();
                        let pattern_lower = pattern.to_lowercase();
                        
                        // Handle wildcard patterns
                        if pattern_lower.starts_with('*') && pattern_lower.ends_with('*') {
                            // *pattern* - contains
                            let pattern_clean = pattern_lower.trim_start_matches('*').trim_end_matches('*');
                            title_lower.contains(&pattern_clean)
                        } else if pattern_lower.starts_with('*') {
                            // *pattern - ends with
                            let pattern_clean = pattern_lower.trim_start_matches('*');
                            title_lower.ends_with(&pattern_clean)
                        } else if pattern_lower.ends_with('*') {
                            // pattern* - starts with
                            let pattern_clean = pattern_lower.trim_end_matches('*');
                            title_lower.starts_with(&pattern_clean)
                        } else {
                            // No wildcard - contains
                            title_lower.contains(&pattern_lower)
                        }
                    } else {
                        false
                    }
                }
                "domain" => {
                    if let Some(d) = domain {
                        let domain_lower = d.to_lowercase();
                        let pattern_lower = pattern.to_lowercase();
                        
                        // Handle wildcard patterns
                        if pattern_lower.starts_with('*') && pattern_lower.ends_with('*') {
                            // *pattern* - contains
                            let pattern_clean = pattern_lower.trim_start_matches('*').trim_end_matches('*');
                            domain_lower.contains(&pattern_clean)
                        } else if pattern_lower.starts_with('*') {
                            // *pattern - ends with
                            let pattern_clean = pattern_lower.trim_start_matches('*');
                            domain_lower.ends_with(&pattern_clean)
                        } else if pattern_lower.ends_with('*') {
                            // pattern* - starts with
                            let pattern_clean = pattern_lower.trim_end_matches('*');
                            domain_lower.starts_with(&pattern_clean)
                        } else {
                            // No wildcard - contains
                            domain_lower.contains(&pattern_lower)
                        }
                    } else {
                        false
                    }
                }
                _ => false,
            };

            if matches {
                // Verify that the category still exists before returning it
                // This prevents FOREIGN KEY constraint errors if a category was deleted
                let category_exists: bool = conn
                    .query_row(
                        "SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)",
                        params![category_id],
                        |row| row.get(0),
                    )
                    .unwrap_or(false);
                
                if category_exists {
                    return Some(category_id);
                }
                // If category doesn't exist, continue to next rule
            }
        }

        // Default to uncategorized, but verify it exists
        let uncategorized_exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)",
                params![SYSTEM_CATEGORY_UNCATEGORIZED],
                |row| row.get(0),
            )
            .unwrap_or(false);
        
        if uncategorized_exists {
            Some(SYSTEM_CATEGORY_UNCATEGORIZED)
        } else {
            // If uncategorized category doesn't exist, return None
            // This should never happen, but handle it gracefully
            None
        }
    }

    /// Record idle start time
    pub fn record_idle_start(&self, timestamp: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Ensure system category exists before using it
        let category_exists: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?)",
            params![SYSTEM_CATEGORY_UNCATEGORIZED],
            |row| row.get(0),
        ).unwrap_or(false);
        
        if !category_exists {
            conn.execute(
                "INSERT INTO categories (id, name, color, icon, is_productive, sort_order, is_system, is_pinned) VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)",
                params![SYSTEM_CATEGORY_UNCATEGORIZED, "Uncategorized", "#9E9E9E", "❓", None::<bool>, 8, false],
            )?;
        }
        
        conn.execute(
            "INSERT INTO activities (app_name, window_title, domain, category_id, project_id, task_id, started_at, duration_sec, is_idle)
             VALUES ('Idle', NULL, NULL, ?, NULL, NULL, ?, 0, TRUE)",
            params![SYSTEM_CATEGORY_UNCATEGORIZED, timestamp],
        )?;
        Ok(())
    }

    /// Update idle duration
    pub fn update_idle_duration(&self, started_at: i64, duration_sec: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE activities SET duration_sec = ? WHERE app_name = 'Idle' AND started_at = ?",
            params![duration_sec, started_at],
        )?;
        Ok(())
    }

    /// Update idle activity with category and description
    pub fn update_idle_activity(
        &self,
        started_at: i64,
        category_id: i64,
        description: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE activities SET category_id = ?, window_title = ? WHERE app_name = 'Idle' AND started_at = ?",
            params![category_id, description, started_at],
        )?;
        Ok(())
    }

    /// Add manual entry
    pub fn add_manual_entry(
        &self,
        description: Option<&str>,
        category_id: Option<i64>,
        started_at: i64,
        ended_at: i64,
        project_id: Option<i64>,
        task_id: Option<i64>,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        // Use empty string for entry_type to maintain compatibility during migration
        // This will be removed in a future migration
        conn.execute(
            "INSERT INTO manual_entries (entry_type, description, category_id, started_at, ended_at, project_id, task_id)
             VALUES ('', ?, ?, ?, ?, ?, ?)",
            params![description, category_id, started_at, ended_at, project_id, task_id],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Get activities for a time range
    pub fn get_activities(&self, start: i64, end: i64) -> Result<Vec<Activity>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, app_name, window_title, domain, category_id, project_id, task_id, started_at, duration_sec, is_idle
             FROM activities
             WHERE started_at >= ? AND started_at <= ?
             ORDER BY started_at ASC",
        )?;

        let activities = stmt
            .query_map(params![start, end], |row| {
                Ok(Activity {
                    id: row.get(0)?,
                    app_name: row.get(1)?,
                    window_title: row.get(2)?,
                    domain: row.get(3)?,
                    category_id: row.get(4)?,
                    project_id: row.get(5)?,
                    task_id: row.get(6)?,
                    started_at: row.get(7)?,
                    duration_sec: row.get(8)?,
                    is_idle: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(activities)
    }

    /// Get all categories
    pub fn get_categories(&self) -> Result<Vec<Category>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, color, icon, is_productive, is_billable, hourly_rate, sort_order, is_system, is_pinned, project_id, task_id
             FROM categories
             ORDER BY sort_order ASC",
        )?;

        let categories = stmt
            .query_map([], |row| {
                Ok(Category {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    icon: row.get(3)?,
                    is_productive: row.get(4)?,
                    is_billable: row.get(5)?,
                    hourly_rate: row.get(6)?,
                    sort_order: row.get(7)?,
                    is_system: row.get(8)?,
                    is_pinned: row.get(9)?,
                    project_id: row.get(10)?,
                    task_id: row.get(11)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(categories)
    }

    /// Get all rules
    pub fn get_rules(&self) -> Result<Vec<Rule>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, rule_type, pattern, category_id, priority
             FROM rules
             ORDER BY priority DESC",
        )?;

        let rules = stmt
            .query_map([], |row| {
                Ok(Rule {
                    id: row.get(0)?,
                    rule_type: row.get(1)?,
                    pattern: row.get(2)?,
                    category_id: row.get(3)?,
                    priority: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(rules)
    }

    /// Add a new rule
    pub fn add_rule(
        &self,
        rule_type: &str,
        pattern: &str,
        category_id: i64,
        priority: i64,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO rules (rule_type, pattern, category_id, priority)
             VALUES (?, ?, ?, ?)",
            params![rule_type, pattern, category_id, priority],
        )
        .map_err(|e| {
            // Convert unique constraint error to user-friendly message
            if let rusqlite::Error::SqliteFailure(ref err, Some(ref msg)) = e {
                // Check if it's a constraint violation related to rules uniqueness
                if err.code == rusqlite::ffi::ErrorCode::ConstraintViolation
                    && (msg.contains("rules.rule_type") 
                        || msg.contains("idx_rules_unique")
                        || (msg.contains("UNIQUE constraint") && msg.contains("rules")))
                {
                    return rusqlite::Error::SqliteFailure(
                        rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
                        Some("A rule with this pattern and category already exists".to_string()),
                    );
                }
            }
            e
        })?;
        Ok(conn.last_insert_rowid())
    }

    /// Delete a rule
    pub fn delete_rule(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM rules WHERE id = ?", params![id])?;
        Ok(())
    }

    /// Get manual entries for a time range
    pub fn get_manual_entries(&self, start: i64, end: i64) -> Result<Vec<ManualEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, description, category_id, project, project_id, task_id, started_at, ended_at
             FROM manual_entries
             WHERE started_at >= ? AND started_at <= ?
             ORDER BY started_at ASC",
        )?;

        let entries = stmt
            .query_map(params![start, end], |row| {
                Ok(ManualEntry {
                    id: row.get(0)?,
                    description: row.get(1)?,
                    category_id: row.get(2)?,
                    project: row.get(3)?,
                    project_id: row.get(4)?,
                    task_id: row.get(5)?,
                    started_at: row.get(6)?,
                    ended_at: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(entries)
    }

    /// Get setting value
    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?",
            params![key],
            |row| row.get(0),
        )
        .optional()
    }

    /// Set setting value
    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            params![key, value],
        )?;
        Ok(())
    }

    /// Get total time for today
    pub fn get_today_total(&self) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let today_start = Local::now()
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_local_timezone(Local)
            .unwrap()
            .timestamp();

        // Sum activities (excluding idle)
        let activities_total: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(duration_sec), 0) FROM activities WHERE started_at >= ? AND is_idle = FALSE",
                params![today_start],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // Sum manual entries duration (ended_at - started_at)
        let manual_total: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(ended_at - started_at), 0) FROM manual_entries WHERE started_at >= ?",
                params![today_start],
                |row| row.get(0),
            )
            .unwrap_or(0);

        Ok(activities_total + manual_total)
    }

    /// Get last activity started today (for active session calculation)
    pub fn get_last_activity_today(&self) -> Result<Option<(i64, i64, i64, String)>> {
        let conn = self.conn.lock().unwrap();
        let today_start = Local::now()
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_local_timezone(Local)
            .unwrap()
            .timestamp();
        
        conn.query_row(
            "SELECT id, started_at, duration_sec, app_name FROM activities WHERE started_at >= ? AND is_idle = FALSE ORDER BY started_at DESC LIMIT 1",
            params![today_start],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .optional()
    }

    /// Get activity by ID
    pub fn get_activity_by_id(&self, id: i64) -> Result<Option<Activity>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, app_name, window_title, domain, category_id, project_id, task_id, started_at, duration_sec, is_idle
             FROM activities WHERE id = ?",
            params![id],
            |row| {
                Ok(Activity {
                    id: row.get(0)?,
                    app_name: row.get(1)?,
                    window_title: row.get(2)?,
                    domain: row.get(3)?,
                    category_id: row.get(4)?,
                    project_id: row.get(5)?,
                    task_id: row.get(6)?,
                    started_at: row.get(7)?,
                    duration_sec: row.get(8)?,
                    is_idle: row.get(9)?,
                })
            },
        )
        .optional()
    }

    /// Update activity category
    pub fn update_activity_category(&self, id: i64, category_id: Option<i64>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE activities SET category_id = ? WHERE id = ?",
            params![category_id, id],
        )?;
        Ok(())
    }

    /// Delete activity
    pub fn delete_activity(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM activities WHERE id = ?", params![id])?;
        Ok(())
    }

    /// Reapply categorization rules to all activities
    pub fn reapply_categorization_rules(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Get all activities
        let mut stmt = conn.prepare(
            "SELECT id, app_name, window_title, domain FROM activities"
        )?;
        
        let activities = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })?;
        
        for activity in activities {
            let (id, app_name, window_title, domain) = activity?;
            let category_id = self.find_category_for_activity(
                &conn,
                &app_name,
                window_title.as_deref(),
                domain.as_deref(),
            );
            
            // Handle None case (shouldn't happen normally, but handle gracefully)
            match category_id {
                Some(cat_id) => {
                    conn.execute(
                        "UPDATE activities SET category_id = ? WHERE id = ?",
                        params![cat_id, id],
                    )?;
                }
                None => {
                    // Set category_id to NULL if no category found
                    conn.execute(
                        "UPDATE activities SET category_id = NULL WHERE id = ?",
                        params![id],
                    )?;
                }
            }
        }
        
        Ok(())
    }

    /// Create category
    pub fn create_category(
        &self,
        name: &str,
        color: &str,
        icon: Option<&str>,
        is_productive: Option<bool>,
        is_billable: Option<bool>,
        hourly_rate: Option<f64>,
        sort_order: i64,
        is_system: bool,
        is_pinned: bool,
        project_id: Option<i64>,
        task_id: Option<i64>,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO categories (name, color, icon, is_productive, is_billable, hourly_rate, sort_order, is_system, is_pinned, project_id, task_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![name, color, icon, is_productive, is_billable, hourly_rate, sort_order, is_system, is_pinned, project_id, task_id],
        )
        .map_err(|e| {
            // Convert unique constraint error to user-friendly message
            if let rusqlite::Error::SqliteFailure(ref err, Some(ref msg)) = e {
                // Check if it's a constraint violation related to category name uniqueness
                if err.code == rusqlite::ffi::ErrorCode::ConstraintViolation
                    && (msg.contains("categories.name") 
                        || (msg.contains("UNIQUE constraint") && msg.contains("categories")))
                {
                    return rusqlite::Error::SqliteFailure(
                        rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
                        Some("A category with this name already exists".to_string()),
                    );
                }
            }
            e
        })?;
        Ok(conn.last_insert_rowid())
    }

    /// Reset system category to default values
    pub fn reset_system_category(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Check if category is a system category
        let is_system: bool = conn.query_row(
            "SELECT is_system FROM categories WHERE id = ?",
            params![id],
            |row| row.get(0),
        )?;

        if !is_system {
            return Err(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
                Some("Only system categories can be reset".to_string()),
            ));
        }

        // Get category name to determine default values
        let category_name: String = conn.query_row(
            "SELECT name FROM categories WHERE id = ?",
            params![id],
            |row| row.get(0),
        )?;

        // Default values for system categories
        let (color, icon, is_productive, sort_order, is_pinned) = match category_name.as_str() {
            "Thinking" => ("#00BCD4", Some("🧠"), Some(true), 6, true),
            "Break" => ("#795548", Some("☕"), Some(false), 7, true),
            "Uncategorized" => ("#9E9E9E", Some("❓"), None, 8, false),
            _ => {
                return Err(rusqlite::Error::SqliteFailure(
                    rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
                    Some(format!("Unknown system category: {}", category_name)),
                ));
            }
        };

        // Reset to default values (keep name, is_system, is_billable, hourly_rate unchanged)
        conn.execute(
            "UPDATE categories SET color = ?, icon = ?, is_productive = ?, sort_order = ?, is_pinned = ?
             WHERE id = ?",
            params![color, icon, is_productive, sort_order, is_pinned, id],
        )?;
        
        Ok(())
    }

    /// Update category
    pub fn update_category(
        &self,
        id: i64,
        name: &str,
        color: &str,
        icon: Option<&str>,
        is_productive: Option<bool>,
        is_billable: Option<bool>,
        hourly_rate: Option<f64>,
        sort_order: i64,
        is_pinned: bool,
        project_id: Option<i64>,
        task_id: Option<i64>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Prevent updating is_system field for system categories
        // Only allow updating is_pinned for system categories
        conn.execute(
            "UPDATE categories SET name = ?, color = ?, icon = ?, is_productive = ?, is_billable = ?, hourly_rate = ?, sort_order = ?, is_pinned = ?, project_id = ?, task_id = ?
             WHERE id = ?",
            params![name, color, icon, is_productive, is_billable, hourly_rate, sort_order, is_pinned, project_id, task_id, id],
        )
        .map_err(|e| {
            // Convert unique constraint error to user-friendly message
            if let rusqlite::Error::SqliteFailure(ref err, Some(ref msg)) = e {
                // Check if it's a constraint violation related to category name uniqueness
                if err.code == rusqlite::ffi::ErrorCode::ConstraintViolation
                    && (msg.contains("categories.name") 
                        || (msg.contains("UNIQUE constraint") && msg.contains("categories")))
                {
                    return rusqlite::Error::SqliteFailure(
                        rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
                        Some("A category with this name already exists".to_string()),
                    );
                }
            }
            e
        })?;
        Ok(())
    }

    /// Delete category (with validation)
    pub fn delete_category(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
        // Check if category is a system category
        let is_system: bool = conn.query_row(
            "SELECT is_system FROM categories WHERE id = ?",
            params![id],
            |row| row.get(0),
        )?;

        if is_system {
            return Err(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
                Some("Cannot delete system category".to_string()),
            ));
        }
        
        // Check if category is used by activities
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM activities WHERE category_id = ?",
            params![id],
            |row| row.get(0),
        )?;

        if count > 0 {
            return Err(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
                Some(format!("Category is used by {} activities", count)),
            ));
        }

        // Check if category is used by rules
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM rules WHERE category_id = ?",
            params![id],
            |row| row.get(0),
        )?;

        if count > 0 {
            return Err(rusqlite::Error::SqliteFailure(
                rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
                Some(format!("Category is used by {} rules", count)),
            ));
        }

        conn.execute("DELETE FROM categories WHERE id = ?", params![id])?;
        Ok(())
    }

    /// Find category by name
    pub fn find_category_by_name(&self, name: &str) -> Result<Option<i64>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id FROM categories WHERE LOWER(name) = LOWER(?)",
            params![name],
            |row| row.get(0),
        )
        .optional()
    }

    /// Update rule
    pub fn update_rule(
        &self,
        id: i64,
        rule_type: &str,
        pattern: &str,
        category_id: i64,
        priority: i64,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE rules SET rule_type = ?, pattern = ?, category_id = ?, priority = ?
             WHERE id = ?",
            params![rule_type, pattern, category_id, priority, id],
        )
        .map_err(|e| {
            // Convert unique constraint error to user-friendly message
            if let rusqlite::Error::SqliteFailure(ref err, Some(ref msg)) = e {
                // Check if it's a constraint violation related to rules uniqueness
                if err.code == rusqlite::ffi::ErrorCode::ConstraintViolation
                    && (msg.contains("rules.rule_type") 
                        || msg.contains("idx_rules_unique")
                        || (msg.contains("UNIQUE constraint") && msg.contains("rules")))
                {
                    return rusqlite::Error::SqliteFailure(
                        rusqlite::ffi::Error::new(rusqlite::ffi::SQLITE_CONSTRAINT),
                        Some("A rule with this pattern and category already exists".to_string()),
                    );
                }
            }
            e
        })?;
        Ok(())
    }

    /// Update manual entry
    pub fn update_manual_entry(
        &self,
        id: i64,
        description: Option<&str>,
        category_id: Option<i64>,
        project: Option<&str>,
        project_id: Option<i64>,
        task_id: Option<i64>,
        started_at: i64,
        ended_at: i64,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        // Use empty string for entry_type to maintain compatibility during migration
        conn.execute(
            "UPDATE manual_entries SET entry_type = '', description = ?, category_id = ?, 
             project = ?, project_id = ?, task_id = ?, started_at = ?, ended_at = ? WHERE id = ?",
            params![description, category_id, project, project_id, task_id, started_at, ended_at, id],
        )?;
        Ok(())
    }

    /// Delete manual entry
    pub fn delete_manual_entry(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM manual_entries WHERE id = ?", params![id])?;
        Ok(())
    }

    /// Get all settings as a map
    pub fn get_all_settings(&self) -> Result<std::collections::HashMap<String, String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
        let settings_iter = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut settings = std::collections::HashMap::new();
        for setting in settings_iter {
            let (key, value) = setting?;
            settings.insert(key, value);
        }
        Ok(settings)
    }

    /// Set multiple settings
    pub fn set_settings(&self, settings: &std::collections::HashMap<String, String>) -> Result<()> {
        let mut conn = self.conn.lock().unwrap();
        let tx = conn.transaction()?;
        for (key, value) in settings {
            tx.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                params![key, value],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// Get daily stats
    pub fn get_daily_stats(&self, date: i64) -> Result<DailyStats> {
        let start = date;
        let end = date + 86400; // 24 hours

        let activities = self.get_activities(start, end)?;
        let categories = self.get_categories()?;

        let total_seconds: i64 = activities.iter().filter(|a| !a.is_idle).map(|a| a.duration_sec).sum();

        let productive_seconds: i64 = activities
            .iter()
            .filter(|a| !a.is_idle)
            .filter(|a| {
                if let Some(cat_id) = a.category_id {
                    categories
                        .iter()
                        .find(|c| c.id == cat_id)
                        .map(|c| c.is_productive.unwrap_or(false))
                        .unwrap_or(false)
                } else {
                    false
                }
            })
            .map(|a| a.duration_sec)
            .sum();

        // Aggregate by category
        let mut category_times: std::collections::HashMap<i64, i64> = std::collections::HashMap::new();
        for activity in &activities {
            if !activity.is_idle {
                if let Some(cat_id) = activity.category_id {
                    *category_times.entry(cat_id).or_insert(0) += activity.duration_sec;
                }
            }
        }

        let mut category_stats: Vec<CategoryStat> = category_times
            .into_iter()
            .map(|(id, seconds)| {
                let cat = categories.iter().find(|c| c.id == id).cloned();
                let percentage = if total_seconds > 0 {
                    (seconds as f64 / total_seconds as f64 * 100.0) as i64
                } else {
                    0
                };
                CategoryStat {
                    category: cat,
                    duration_sec: seconds,
                    percentage,
                }
            })
            .collect();
        category_stats.sort_by(|a, b| b.duration_sec.cmp(&a.duration_sec));

        // Aggregate by app
        let mut app_times: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
        for activity in &activities {
            if !activity.is_idle {
                *app_times.entry(activity.app_name.clone()).or_insert(0) += activity.duration_sec;
            }
        }

        let mut app_stats: Vec<AppStat> = app_times
            .into_iter()
            .map(|(name, seconds)| {
                // Find category for this app
                let category = activities
                    .iter()
                    .find(|a| a.app_name == name && !a.is_idle)
                    .and_then(|a| a.category_id)
                    .and_then(|cat_id| categories.iter().find(|c| c.id == cat_id).cloned());
                
                AppStat {
                    app_name: name,
                    duration_sec: seconds,
                    category,
                }
            })
            .collect();
        app_stats.sort_by(|a, b| b.duration_sec.cmp(&a.duration_sec));

        Ok(DailyStats {
            total_seconds,
            productive_seconds,
            category_stats,
            app_stats,
        })
    }

    /// Get top apps
    pub fn get_top_apps(&self, start: i64, end: i64, limit: i64) -> Result<Vec<AppStat>> {
        let activities = self.get_activities(start, end)?;
        let categories = self.get_categories()?;

        let mut app_times: std::collections::HashMap<String, i64> = std::collections::HashMap::new();
        for activity in &activities {
            if !activity.is_idle {
                *app_times.entry(activity.app_name.clone()).or_insert(0) += activity.duration_sec;
            }
        }

        let mut app_stats: Vec<AppStat> = app_times
            .into_iter()
            .map(|(name, seconds)| {
                let category = activities
                    .iter()
                    .find(|a| a.app_name == name && !a.is_idle)
                    .and_then(|a| a.category_id)
                    .and_then(|cat_id| categories.iter().find(|c| c.id == cat_id).cloned());
                
                AppStat {
                    app_name: name,
                    duration_sec: seconds,
                    category,
                }
            })
            .collect();
        app_stats.sort_by(|a, b| b.duration_sec.cmp(&a.duration_sec));
        app_stats.truncate(limit as usize);

        Ok(app_stats)
    }

    /// Get category usage
    pub fn get_category_usage(&self, start: i64, end: i64) -> Result<Vec<CategoryUsageStat>> {
        let activities = self.get_activities(start, end)?;
        let categories = self.get_categories()?;

        let mut category_times: std::collections::HashMap<i64, i64> = std::collections::HashMap::new();
        for activity in &activities {
            if !activity.is_idle {
                if let Some(cat_id) = activity.category_id {
                    *category_times.entry(cat_id).or_insert(0) += activity.duration_sec;
                }
            }
        }

        let total: i64 = category_times.values().sum();
        let mut category_stats: Vec<CategoryUsageStat> = category_times
            .into_iter()
            .map(|(id, seconds)| {
                let category = categories.iter().find(|c| c.id == id).cloned();
                let percentage = if total > 0 {
                    (seconds as f64 / total as f64 * 100.0) as i64
                } else {
                    0
                };
                CategoryUsageStat {
                    category,
                    duration_sec: seconds,
                    percentage,
                }
            })
            .collect();
        category_stats.sort_by(|a, b| b.duration_sec.cmp(&a.duration_sec));

        Ok(category_stats)
    }

    /// Get hourly activity
    pub fn get_hourly_activity(&self, date: i64) -> Result<Vec<HourlyStat>> {
        let start = date;
        let end = date + 86400;

        let activities = self.get_activities(start, end)?;
        let mut hourly: std::collections::HashMap<i64, i64> = std::collections::HashMap::new();

        for activity in &activities {
            if !activity.is_idle {
                let hour = (activity.started_at - start) / 3600;
                *hourly.entry(hour).or_insert(0) += activity.duration_sec;
            }
        }

        let mut stats: Vec<HourlyStat> = hourly
            .into_iter()
            .map(|(hour, duration_sec)| HourlyStat { hour, duration_sec })
            .collect();
        stats.sort_by(|a, b| a.hour.cmp(&b.hour));

        Ok(stats)
    }

    /// Get productive time
    pub fn get_productive_time(&self, start: i64, end: i64) -> Result<i64> {
        let activities = self.get_activities(start, end)?;
        let categories = self.get_categories()?;

        let productive_seconds: i64 = activities
            .iter()
            .filter(|a| !a.is_idle)
            .filter(|a| {
                if let Some(cat_id) = a.category_id {
                    categories
                        .iter()
                        .find(|c| c.id == cat_id)
                        .map(|c| c.is_productive.unwrap_or(false))
                        .unwrap_or(false)
                } else {
                    false
                }
            })
            .map(|a| a.duration_sec)
            .sum();

        Ok(productive_seconds)
    }

    // ========== PROJECT METHODS ==========

    /// Create a new project
    pub fn create_project(
        &self,
        name: &str,
        client_name: Option<&str>,
        color: &str,
        is_billable: bool,
        hourly_rate: f64,
        budget_hours: Option<f64>,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let created_at = Utc::now().timestamp();
        conn.execute(
            "INSERT INTO projects (name, client_name, color, is_billable, hourly_rate, budget_hours, created_at, archived)
             VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)",
            params![name, client_name, color, is_billable, hourly_rate, budget_hours, created_at],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Get all projects
    pub fn get_projects(&self, include_archived: bool) -> Result<Vec<Project>> {
        let conn = self.conn.lock().unwrap();
        let query = if include_archived {
            "SELECT id, name, client_name, color, is_billable, hourly_rate, budget_hours, created_at, archived
             FROM projects ORDER BY created_at DESC"
        } else {
            "SELECT id, name, client_name, color, is_billable, hourly_rate, budget_hours, created_at, archived
             FROM projects WHERE archived = FALSE ORDER BY created_at DESC"
        };
        let mut stmt = conn.prepare(query)?;
        let projects = stmt
            .query_map([], |row| {
                let is_archived: bool = row.get(8)?;
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(3)?,
                    is_archived,
                    created_at: row.get(7)?,
                    client_name: row.get(2)?,
                    is_billable: row.get(4)?,
                    hourly_rate: row.get(5)?,
                    budget_hours: row.get(6)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        
        Ok(projects)
    }

    /// Update a project
    pub fn update_project(
        &self,
        id: i64,
        name: &str,
        client_name: Option<&str>,
        color: &str,
        is_billable: bool,
        hourly_rate: f64,
        budget_hours: Option<f64>,
        is_archived: Option<bool>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        if let Some(archived) = is_archived {
            conn.execute(
                "UPDATE projects SET name = ?, client_name = ?, color = ?, is_billable = ?, hourly_rate = ?, budget_hours = ?, archived = ?
                 WHERE id = ?",
                params![name, client_name, color, is_billable, hourly_rate, budget_hours, archived, id],
            )?;
        } else {
            conn.execute(
                "UPDATE projects SET name = ?, client_name = ?, color = ?, is_billable = ?, hourly_rate = ?, budget_hours = ?
                 WHERE id = ?",
                params![name, client_name, color, is_billable, hourly_rate, budget_hours, id],
            )?;
        }
        Ok(())
    }

    /// Delete a project (soft delete by archiving)
    pub fn delete_project(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE projects SET archived = TRUE WHERE id = ?",
            params![id],
        )?;
        Ok(())
    }

    /// Get project by ID
    pub fn get_project_by_id(&self, id: i64) -> Result<Option<Project>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, name, client_name, color, is_billable, hourly_rate, budget_hours, created_at, archived
             FROM projects WHERE id = ?",
            params![id],
            |row| {
                let is_archived: bool = row.get(8)?;
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(3)?,
                    is_archived,
                    created_at: row.get(7)?,
                    client_name: row.get(2)?,
                    is_billable: row.get(4)?,
                    hourly_rate: row.get(5)?,
                    budget_hours: row.get(6)?,
                })
            },
        )
        .optional()
    }

    // ========== TASK METHODS ==========

    /// Create a new task
    pub fn create_task(
        &self,
        project_id: i64,
        name: &str,
        description: Option<&str>,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let created_at = Utc::now().timestamp();
        conn.execute(
            "INSERT INTO tasks (project_id, name, description, created_at, archived)
             VALUES (?, ?, ?, ?, FALSE)",
            params![project_id, name, description, created_at],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Get tasks for a project
    pub fn get_tasks(&self, project_id: Option<i64>, include_archived: bool) -> Result<Vec<Task>> {
        let conn = self.conn.lock().unwrap();
        let query = if let Some(_pid) = project_id {
            if include_archived {
                "SELECT id, project_id, name, description, created_at, archived
                 FROM tasks WHERE project_id = ? ORDER BY created_at DESC"
            } else {
                "SELECT id, project_id, name, description, created_at, archived
                 FROM tasks WHERE project_id = ? AND archived = FALSE ORDER BY created_at DESC"
            }
        } else {
            if include_archived {
                "SELECT id, project_id, name, description, created_at, archived
                 FROM tasks ORDER BY created_at DESC"
            } else {
                "SELECT id, project_id, name, description, created_at, archived
                 FROM tasks WHERE archived = FALSE ORDER BY created_at DESC"
            }
        };
        let mut stmt = conn.prepare(query)?;
        let map_task = |row: &rusqlite::Row| -> rusqlite::Result<Task> {
            Ok(Task {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                created_at: row.get(4)?,
                archived: row.get(5)?,
            })
        };
        let tasks = if let Some(pid) = project_id {
            stmt.query_map(params![pid], map_task)?
        } else {
            stmt.query_map([], map_task)?
        };
        let tasks = tasks.collect::<Result<Vec<_>>>()?;
        Ok(tasks)
    }

    /// Update a task
    pub fn update_task(
        &self,
        id: i64,
        name: &str,
        description: Option<&str>,
        archived: Option<bool>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        if let Some(archived_value) = archived {
            conn.execute(
                "UPDATE tasks SET name = ?, description = ?, archived = ? WHERE id = ?",
                params![name, description, archived_value, id],
            )?;
        } else {
            conn.execute(
                "UPDATE tasks SET name = ?, description = ? WHERE id = ?",
                params![name, description, id],
            )?;
        }
        Ok(())
    }

    /// Delete a task (soft delete by archiving)
    pub fn delete_task(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE tasks SET archived = TRUE WHERE id = ?",
            params![id],
        )?;
        Ok(())
    }

    /// Get task by ID
    pub fn get_task_by_id(&self, id: i64) -> Result<Option<Task>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, project_id, name, description, created_at, archived
             FROM tasks WHERE id = ?",
            params![id],
            |row| {
                Ok(Task {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    description: row.get(3)?,
                    created_at: row.get(4)?,
                    archived: row.get(5)?,
                })
            },
        )
        .optional()
    }

    // ========== BILLABLE TIME METHODS ==========

    // TODO: Refactor billable logic - currently billable can come from both categories and projects.
    // Consider:
    // 1. Should project billable override category billable, or should they be combined (OR/AND logic)?
    // 2. Should we have a unified billable calculation function to avoid code duplication?
    // 3. What happens when both category and project have billable=true but different hourly rates?
    // 4. Should we add a billable field directly to activities table for performance?

    /// Get billable hours for a time range
    pub fn get_billable_hours(&self, start: i64, end: i64) -> Result<i64> {
        let activities = self.get_activities(start, end)?;
        let categories = self.get_categories()?;
        let projects = self.get_projects(true)?;

        let billable_seconds: i64 = activities
            .iter()
            .filter(|a| !a.is_idle)
            .filter(|a| {
                // Check if activity is billable via category
                if let Some(cat_id) = a.category_id {
                    if let Some(cat) = categories.iter().find(|c| c.id == cat_id) {
                        if cat.is_billable.unwrap_or(false) {
                            return true;
                        }
                    }
                }
                // Check if activity is billable via project
                if let Some(proj_id) = a.project_id {
                    if let Some(proj) = projects.iter().find(|p| p.id == proj_id) {
                        if proj.is_billable {
                            return true;
                        }
                    }
                }
                false
            })
            .map(|a| a.duration_sec)
            .sum();

        Ok(billable_seconds)
    }

    /// Get billable revenue for a time range
    /// 
    /// TODO: This method uses project rate precedence over category rate.
    /// Consider if this is the desired behavior or if we need more flexible logic.
    /// See TODO in get_billable_hours for more discussion.
    pub fn get_billable_revenue(&self, start: i64, end: i64) -> Result<f64> {
        let activities = self.get_activities(start, end)?;
        let categories = self.get_categories()?;
        let projects = self.get_projects(true)?;

        let mut total_revenue = 0.0;

        for activity in activities.iter().filter(|a| !a.is_idle) {
            let mut rate = 0.0;
            let mut is_billable = false;

            // Check project first (project rate takes precedence)
            if let Some(proj_id) = activity.project_id {
                if let Some(proj) = projects.iter().find(|p| p.id == proj_id) {
                    if proj.is_billable && proj.hourly_rate > 0.0 {
                        rate = proj.hourly_rate;
                        is_billable = true;
                    }
                }
            }

            // Fall back to category rate if no project rate
            if !is_billable {
                if let Some(cat_id) = activity.category_id {
                    if let Some(cat) = categories.iter().find(|c| c.id == cat_id) {
                        if cat.is_billable.unwrap_or(false) && cat.hourly_rate.unwrap_or(0.0) > 0.0 {
                            rate = cat.hourly_rate.unwrap_or(0.0);
                            is_billable = true;
                        }
                    }
                }
            }

            if is_billable && rate > 0.0 {
                let hours = activity.duration_sec as f64 / 3600.0;
                total_revenue += hours * rate;
            }
        }

        Ok(total_revenue)
    }

    // ========== DOMAIN METHODS ==========

    /// Get top domains for a time range
    pub fn get_top_domains(&self, start: i64, end: i64, limit: i64) -> Result<Vec<DomainStat>> {
        let activities = self.get_activities(start, end)?;
        let mut domain_times: std::collections::HashMap<String, i64> = std::collections::HashMap::new();

        for activity in &activities {
            if !activity.is_idle {
                if let Some(domain) = &activity.domain {
                    *domain_times.entry(domain.clone()).or_insert(0) += activity.duration_sec;
                }
            }
        }

        let mut domain_stats: Vec<DomainStat> = domain_times
            .into_iter()
            .map(|(domain, duration_sec)| DomainStat {
                domain,
                duration_sec,
            })
            .collect();
        domain_stats.sort_by(|a, b| b.duration_sec.cmp(&a.duration_sec));
        domain_stats.truncate(limit as usize);

        Ok(domain_stats)
    }

    // ========== FOCUS SESSION METHODS ==========

    /// Create a focus session
    pub fn create_focus_session(
        &self,
        pomodoro_type: &str,
        project_id: Option<i64>,
        task_id: Option<i64>,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let started_at = Utc::now().timestamp();
        conn.execute(
            "INSERT INTO focus_sessions (started_at, pomodoro_type, project_id, task_id, completed)
             VALUES (?, ?, ?, ?, FALSE)",
            params![started_at, pomodoro_type, project_id, task_id],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Update focus session (end it)
    pub fn update_focus_session(
        &self,
        id: i64,
        duration_sec: i64,
        completed: bool,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let ended_at = Utc::now().timestamp();
        conn.execute(
            "UPDATE focus_sessions SET ended_at = ?, duration_sec = ?, completed = ? WHERE id = ?",
            params![ended_at, duration_sec, completed, id],
        )?;
        Ok(())
    }

    /// Get focus sessions for a time range
    pub fn get_focus_sessions(&self, start: i64, end: i64) -> Result<Vec<FocusSession>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, started_at, ended_at, duration_sec, pomodoro_type, project_id, task_id, completed
             FROM focus_sessions
             WHERE started_at >= ? AND started_at <= ?
             ORDER BY started_at DESC",
        )?;

        let sessions = stmt
            .query_map(params![start, end], |row| {
                Ok(FocusSession {
                    id: row.get(0)?,
                    started_at: row.get(1)?,
                    ended_at: row.get(2)?,
                    duration_sec: row.get(3)?,
                    pomodoro_type: row.get(4)?,
                    project_id: row.get(5)?,
                    task_id: row.get(6)?,
                    completed: row.get(7)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        Ok(sessions)
    }

    /// Get count of completed work sessions for today
    pub fn get_completed_work_sessions_count_today(&self) -> Result<i32> {
        let conn = self.conn.lock().unwrap();
        
        // Get start and end of today in Unix timestamp
        let now = Utc::now().with_timezone(&Local);
        let start_of_day = now.date_naive().and_hms_opt(0, 0, 0).unwrap();
        let end_of_day = now.date_naive().and_hms_opt(23, 59, 59).unwrap();
        
        let start_timestamp = start_of_day.and_local_timezone(Local).unwrap().timestamp();
        let end_timestamp = end_of_day.and_local_timezone(Local).unwrap().timestamp();
        
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM focus_sessions
             WHERE pomodoro_type = 'work'
             AND completed = 1
             AND started_at >= ? AND started_at <= ?",
            params![start_timestamp, end_timestamp],
            |row| row.get(0),
        )?;
        
        Ok(count)
    }

    /// Delete focus session
    pub fn delete_focus_session(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM focus_sessions WHERE id = ?", params![id])?;
        Ok(())
    }

    /// Get active (not ended) focus session
    pub fn get_active_focus_session(&self) -> Result<Option<FocusSession>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, started_at, ended_at, duration_sec, pomodoro_type, project_id, task_id, completed
             FROM focus_sessions
             WHERE ended_at IS NULL
             ORDER BY started_at DESC
             LIMIT 1",
        )?;

        let session = stmt
            .query_map([], |row| {
                Ok(FocusSession {
                    id: row.get(0)?,
                    started_at: row.get(1)?,
                    ended_at: row.get(2)?,
                    duration_sec: row.get(3)?,
                    pomodoro_type: row.get(4)?,
                    project_id: row.get(5)?,
                    task_id: row.get(6)?,
                    completed: row.get(7)?,
                })
            })?
            .next()
            .transpose()?;

        Ok(session)
    }

    // ========== GOAL METHODS ==========

    /// Create a goal
    pub fn create_goal(
        &self,
        goal_type: &str,
        target_seconds: i64,
        category_id: Option<i64>,
        project_id: Option<i64>,
        start_date: i64,
        end_date: Option<i64>,
        name: Option<&str>,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let created_at = Utc::now().timestamp();
        conn.execute(
            "INSERT INTO goals (goal_type, target_seconds, category_id, project_id, start_date, end_date, created_at, active, name)
             VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?)",
            params![goal_type, target_seconds, category_id, project_id, start_date, end_date, created_at, name],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// Get goals
    pub fn get_goals(&self, active_only: bool) -> Result<Vec<Goal>> {
        let conn = self.conn.lock().unwrap();
        let query = if active_only {
            "SELECT id, goal_type, target_seconds, category_id, project_id, start_date, end_date, created_at, active, name
             FROM goals WHERE active = TRUE ORDER BY created_at DESC"
        } else {
            "SELECT id, goal_type, target_seconds, category_id, project_id, start_date, end_date, created_at, active, name
             FROM goals ORDER BY created_at DESC"
        };
        let mut stmt = conn.prepare(query)?;
        let goals = stmt
            .query_map([], |row| {
                Ok(Goal {
                    id: row.get(0)?,
                    goal_type: row.get(1)?,
                    target_seconds: row.get(2)?,
                    category_id: row.get(3)?,
                    project_id: row.get(4)?,
                    start_date: row.get(5)?,
                    end_date: row.get(6)?,
                    created_at: row.get(7)?,
                    active: row.get(8)?,
                    name: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        Ok(goals)
    }

    /// Update a goal
    pub fn update_goal(
        &self,
        id: i64,
        goal_type: &str,
        target_seconds: i64,
        category_id: Option<i64>,
        project_id: Option<i64>,
        start_date: i64,
        end_date: Option<i64>,
        active: bool,
        name: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE goals SET goal_type = ?, target_seconds = ?, category_id = ?, project_id = ?, 
             start_date = ?, end_date = ?, active = ?, name = ? WHERE id = ?",
            params![goal_type, target_seconds, category_id, project_id, start_date, end_date, active, name, id],
        )?;
        Ok(())
    }

    /// Delete a goal
    pub fn delete_goal(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM goals WHERE id = ?", params![id])?;
        Ok(())
    }

    /// Get goal progress
    pub fn get_goal_progress(&self, goal_id: i64, start: i64, end: i64) -> Result<GoalProgress> {
        let conn = self.conn.lock().unwrap();
        
        let goal: Goal = conn.query_row(
            "SELECT id, goal_type, target_seconds, category_id, project_id, start_date, end_date, created_at, active, name
             FROM goals WHERE id = ?",
            params![goal_id],
            |row| {
                Ok(Goal {
                    id: row.get(0)?,
                    goal_type: row.get(1)?,
                    target_seconds: row.get(2)?,
                    category_id: row.get(3)?,
                    project_id: row.get(4)?,
                    start_date: row.get(5)?,
                    end_date: row.get(6)?,
                    created_at: row.get(7)?,
                    active: row.get(8)?,
                    name: row.get(9)?,
                })
            },
        )?;

        // Get activities using the already locked connection (avoid deadlock)
        let mut activities_stmt = conn.prepare(
            "SELECT id, app_name, window_title, domain, category_id, project_id, task_id, started_at, duration_sec, is_idle
             FROM activities
             WHERE started_at >= ? AND started_at <= ?
             ORDER BY started_at ASC"
        )?;
        
        let activities: Vec<Activity> = activities_stmt
            .query_map(params![start, end], |row| {
                Ok(Activity {
                    id: row.get(0)?,
                    app_name: row.get(1)?,
                    window_title: row.get(2)?,
                    domain: row.get(3)?,
                    category_id: row.get(4)?,
                    project_id: row.get(5)?,
                    task_id: row.get(6)?,
                    started_at: row.get(7)?,
                    duration_sec: row.get(8)?,
                    is_idle: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        
        // Получить focus sessions за период
        let mut focus_sessions_stmt = conn.prepare(
            "SELECT started_at, ended_at, duration_sec, project_id, pomodoro_type, completed
             FROM focus_sessions
             WHERE started_at >= ? AND started_at <= ?"
        )?;

        let focus_sessions: Vec<(i64, Option<i64>, Option<i64>, Option<i64>, String, bool)> = 
            focus_sessions_stmt
                .query_map(params![start, end], |row| {
                    Ok((
                        row.get(0)?, // started_at
                        row.get(1)?, // ended_at
                        row.get(2)?, // duration_sec
                        row.get(3)?, // project_id
                        row.get(4)?, // pomodoro_type
                        row.get(5)?, // completed
                    ))
                })?
                .collect::<Result<Vec<_>>>()?;

        // Собрать ID activities, которые перекрываются с focus sessions
        let mut overlapping_activity_ids = std::collections::HashSet::new();
        let mut focus_session_time = 0i64;

        for (session_start, session_end_opt, duration_opt, session_project_id, pomodoro_type, completed) in &focus_sessions {
            if pomodoro_type == "work" && *completed {
                // Фильтр по project_id если указан в goal
                if let Some(goal_proj_id) = goal.project_id {
                    if *session_project_id != Some(goal_proj_id) {
                        continue;
                    }
                }
                
                let session_end = session_end_opt.unwrap_or(*session_start + duration_opt.unwrap_or(0));
                let duration = duration_opt.unwrap_or(0);
                focus_session_time += duration;
                
                // Найти перекрывающиеся activities
                for activity in activities.iter().filter(|a| !a.is_idle) {
                    // Проверить фильтры goal
                    if let Some(cat_id) = goal.category_id {
                        if activity.category_id != Some(cat_id) {
                            continue;
                        }
                    }
                    
                    if let Some(proj_id) = goal.project_id {
                        if activity.project_id != Some(proj_id) {
                            continue;
                        }
                    }
                    
                    // Проверить перекрытие по времени
                    let activity_end = activity.started_at + activity.duration_sec;
                    if activity.started_at < session_end && activity_end > *session_start {
                        overlapping_activity_ids.insert(activity.id);
                    }
                }
            }
        }

        // Рассчитать время из activities, исключая перекрывающиеся
        let mut current_seconds = 0i64;
        for activity in activities.iter().filter(|a| !a.is_idle) {
            if overlapping_activity_ids.contains(&activity.id) {
                continue; // Пропустить перекрывающееся activity
            }
            
            // Применить фильтры goal
            if let Some(cat_id) = goal.category_id {
                if activity.category_id != Some(cat_id) {
                    continue;
                }
            }
            
            if let Some(proj_id) = goal.project_id {
                if activity.project_id != Some(proj_id) {
                    continue;
                }
            }
            
            current_seconds += activity.duration_sec;
        }

        // Добавить время из focus sessions (приоритет)
        current_seconds += focus_session_time;

        let percentage = if goal.target_seconds > 0 {
            ((current_seconds as f64 / goal.target_seconds as f64) * 100.0).min(100.0)
        } else {
            0.0
        };

        let remaining_seconds = (goal.target_seconds as i64 - current_seconds).max(0);

        Ok(GoalProgress {
            goal,
            current_seconds,
            percentage,
            remaining_seconds,
        })
    }

    /// Check goal alerts (returns goals that need alerts)
    pub fn check_goal_alerts(&self) -> Result<Vec<GoalAlert>> {
        let now = Utc::now().timestamp();
        
        // Lock the connection once and do all operations within the lock
        let conn = self.conn.lock().unwrap();
        
        // Get active goals
        let query = "SELECT id, goal_type, target_seconds, category_id, project_id, start_date, end_date, created_at, active, name
                     FROM goals WHERE active = TRUE ORDER BY created_at DESC";
        let mut stmt = conn.prepare(query)?;
        let goals: Vec<Goal> = stmt
            .query_map([], |row| {
                Ok(Goal {
                    id: row.get(0)?,
                    goal_type: row.get(1)?,
                    target_seconds: row.get(2)?,
                    category_id: row.get(3)?,
                    project_id: row.get(4)?,
                    start_date: row.get(5)?,
                    end_date: row.get(6)?,
                    created_at: row.get(7)?,
                    active: row.get(8)?,
                    name: row.get(9)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;
        
        let mut alerts = Vec::new();

        for goal in goals {
            // Determine date range based on goal type
            let (start, end) = match goal.goal_type.as_str() {
                "daily" => {
                    let today_start = Local::now()
                        .date_naive()
                        .and_hms_opt(0, 0, 0)
                        .unwrap()
                        .and_local_timezone(Local)
                        .unwrap()
                        .timestamp();
                    (today_start, now)
                }
                "weekly" => {
                    let today = Local::now().date_naive();
                    let weekday_num = today.weekday().num_days_from_monday() as i64;
                    let week_start = today - Duration::days(weekday_num);
                    let week_start_ts = week_start.and_hms_opt(0, 0, 0).unwrap().and_local_timezone(Local).unwrap().timestamp();
                    (week_start_ts, now)
                }
                "monthly" => {
                    let today = Local::now().date_naive();
                    let year = today.year();
                    let month = today.month();
                    let month_start = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
                    let month_start_ts = month_start.and_hms_opt(0, 0, 0).unwrap().and_local_timezone(Local).unwrap().timestamp();
                    (month_start_ts, now)
                }
                _ => continue,
            };

            // Get activities for this date range (reuse the locked connection)
            let mut activities_stmt = conn.prepare(
                "SELECT id, app_name, window_title, domain, category_id, project_id, task_id, started_at, duration_sec, is_idle
                 FROM activities
                 WHERE started_at >= ? AND started_at <= ?
                 ORDER BY started_at ASC"
            )?;
            
            let activities: Vec<Activity> = activities_stmt
                .query_map(params![start, end], |row| {
                    Ok(Activity {
                        id: row.get(0)?,
                        app_name: row.get(1)?,
                        window_title: row.get(2)?,
                        domain: row.get(3)?,
                        category_id: row.get(4)?,
                        project_id: row.get(5)?,
                        task_id: row.get(6)?,
                        started_at: row.get(7)?,
                        duration_sec: row.get(8)?,
                        is_idle: row.get(9)?,
                    })
                })?
                .collect::<Result<Vec<_>>>()?;
            
            // Получить focus sessions за период
            let mut focus_sessions_stmt = conn.prepare(
                "SELECT started_at, ended_at, duration_sec, project_id, pomodoro_type, completed
                 FROM focus_sessions
                 WHERE started_at >= ? AND started_at <= ?"
            )?;

            let focus_sessions: Vec<(i64, Option<i64>, Option<i64>, Option<i64>, String, bool)> = 
                focus_sessions_stmt
                    .query_map(params![start, end], |row| {
                        Ok((
                            row.get(0)?, // started_at
                            row.get(1)?, // ended_at
                            row.get(2)?, // duration_sec
                            row.get(3)?, // project_id
                            row.get(4)?, // pomodoro_type
                            row.get(5)?, // completed
                        ))
                    })?
                    .collect::<Result<Vec<_>>>()?;

            // Собрать ID activities, которые перекрываются с focus sessions
            let mut overlapping_activity_ids = std::collections::HashSet::new();
            let mut focus_session_time = 0i64;

            for (session_start, session_end_opt, duration_opt, session_project_id, pomodoro_type, completed) in &focus_sessions {
                if pomodoro_type == "work" && *completed {
                    // Фильтр по project_id если указан в goal
                    if let Some(goal_proj_id) = goal.project_id {
                        if *session_project_id != Some(goal_proj_id) {
                            continue;
                        }
                    }
                    
                    let session_end = session_end_opt.unwrap_or(*session_start + duration_opt.unwrap_or(0));
                    let duration = duration_opt.unwrap_or(0);
                    focus_session_time += duration;
                    
                    // Найти перекрывающиеся activities
                    for activity in activities.iter().filter(|a| !a.is_idle) {
                        // Проверить фильтры goal
                        if let Some(cat_id) = goal.category_id {
                            if activity.category_id != Some(cat_id) {
                                continue;
                            }
                        }
                        
                        if let Some(proj_id) = goal.project_id {
                            if activity.project_id != Some(proj_id) {
                                continue;
                            }
                        }
                        
                        // Проверить перекрытие по времени
                        let activity_end = activity.started_at + activity.duration_sec;
                        if activity.started_at < session_end && activity_end > *session_start {
                            overlapping_activity_ids.insert(activity.id);
                        }
                    }
                }
            }

            // Рассчитать время из activities, исключая перекрывающиеся
            let mut current_seconds = 0i64;
            for activity in activities.iter().filter(|a| !a.is_idle) {
                if overlapping_activity_ids.contains(&activity.id) {
                    continue; // Пропустить перекрывающееся activity
                }
                
                // Применить фильтры goal
                if let Some(cat_id) = goal.category_id {
                    if activity.category_id != Some(cat_id) {
                        continue;
                    }
                }
                
                if let Some(proj_id) = goal.project_id {
                    if activity.project_id != Some(proj_id) {
                        continue;
                    }
                }
                
                current_seconds += activity.duration_sec;
            }

            // Добавить время из focus sessions (приоритет)
            current_seconds += focus_session_time;

            let percentage = if goal.target_seconds > 0 {
                ((current_seconds as f64 / goal.target_seconds as f64) * 100.0).min(100.0)
            } else {
                0.0
            };

            let alert_type = if percentage >= 100.0 {
                Some("completed".to_string())
            } else if percentage >= 80.0 {
                Some("warning".to_string())
            } else {
                None
            };

            if let Some(alert) = alert_type {
                alerts.push(GoalAlert {
                    goal_id: goal.id,
                    goal_name: format!("{} goal", goal.goal_type),
                    alert_type: alert,
                    percentage,
                    current_seconds,
                    target_seconds: goal.target_seconds,
                });
            }
        }

        Ok(alerts)
    }
}

// New structs
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub is_archived: bool,
    pub created_at: i64,
    pub client_name: Option<String>,
    pub is_billable: bool,
    pub hourly_rate: f64,
    pub budget_hours: Option<f64>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Task {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub created_at: i64,
    #[serde(rename = "is_archived")]
    pub archived: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FocusSession {
    pub id: i64,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub duration_sec: Option<i64>,
    pub pomodoro_type: String,
    pub project_id: Option<i64>,
    pub task_id: Option<i64>,
    pub completed: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Goal {
    pub id: i64,
    pub goal_type: String,
    pub target_seconds: i64,
    pub category_id: Option<i64>,
    pub project_id: Option<i64>,
    pub start_date: i64,
    pub end_date: Option<i64>,
    pub created_at: i64,
    pub active: bool,
    pub name: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GoalProgress {
    pub goal: Goal,
    pub current_seconds: i64,
    pub percentage: f64,
    pub remaining_seconds: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GoalAlert {
    pub goal_id: i64,
    pub goal_name: String,
    pub alert_type: String,
    pub percentage: f64,
    pub current_seconds: i64,
    pub target_seconds: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DomainStat {
    pub domain: String,
    pub duration_sec: i64,
}

// Stats structures
#[derive(Debug, Clone)]
pub struct DailyStats {
    pub total_seconds: i64,
    pub productive_seconds: i64,
    pub category_stats: Vec<CategoryStat>,
    pub app_stats: Vec<AppStat>,
}

#[derive(Debug, Clone)]
pub struct CategoryStat {
    pub category: Option<Category>,
    pub duration_sec: i64,
    pub percentage: i64,
}

#[derive(Debug, Clone)]
pub struct AppStat {
    pub app_name: String,
    pub duration_sec: i64,
    pub category: Option<Category>,
}

#[derive(Debug, Clone)]
pub struct CategoryUsageStat {
    pub category: Option<Category>,
    pub duration_sec: i64,
    pub percentage: i64,
}

#[derive(Debug, Clone)]
pub struct HourlyStat {
    pub hour: i64,
    pub duration_sec: i64,
}

// Extension trait for optional query results
trait OptionalExtension<T> {
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
