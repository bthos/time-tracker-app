//! Activity-related database operations

use rusqlite::{Connection, Result, params};
use rusqlite::types::Value as SqliteValue;
use super::common::Database;
use super::models::Activity;
use super::common::SYSTEM_CATEGORY_UNCATEGORIZED;
use chrono::Local;

impl Database {
    /// Insert or update an activity record.
    /// Returns the activity id (existing or newly inserted).
    pub fn upsert_activity(
        &self,
        app_name: &str,
        window_title: Option<&str>,
        domain: Option<&str>,
        timestamp: i64,
    ) -> Result<i64> {
        let conn = self.conn.lock().unwrap();

        // Try to find matching category
        let category_id = self.find_category_for_activity(&conn, app_name, window_title, domain);

        // Check if there's a recent activity for the same app and window title (within 5 minutes)
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

        let id = if let Some((id, duration, started_at)) = existing {
            let time_diff = timestamp - started_at;
            let new_duration = std::cmp::max(duration + 5, time_diff);

            conn.execute(
                "UPDATE activities SET duration_sec = ?, category_id = ? WHERE id = ?",
                params![new_duration, category_id, id],
            )?;
            id
        } else {
            conn.execute(
                "INSERT INTO activities (app_name, window_title, domain, category_id, started_at, duration_sec, is_idle)
                 VALUES (?, ?, ?, ?, ?, 5, FALSE)",
                params![app_name, window_title, domain, category_id, timestamp],
            )?;
            conn.last_insert_rowid()
        };

        Ok(id)
    }

    /// Update an activity row by id (used after plugin hooks modify the activity).
    pub fn update_activity_row(&self, activity: &Activity) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE activities SET app_name = ?, window_title = ?, domain = ?, category_id = ?, started_at = ?, duration_sec = ?, is_idle = ? WHERE id = ?",
            params![
                activity.app_name,
                activity.window_title,
                activity.domain,
                activity.category_id,
                activity.started_at,
                activity.duration_sec,
                activity.is_idle,
                activity.id,
            ],
        )?;
        Ok(())
    }

    /// Find category for an activity based on rules
    pub(crate) fn find_category_for_activity(
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
                    
                    if pattern_lower.starts_with('*') && pattern_lower.ends_with('*') {
                        let pattern_clean = pattern_lower.trim_start_matches('*').trim_end_matches('*');
                        app_lower.contains(&pattern_clean)
                    } else if pattern_lower.starts_with('*') {
                        let pattern_clean = pattern_lower.trim_start_matches('*');
                        app_lower.ends_with(&pattern_clean)
                    } else if pattern_lower.ends_with('*') {
                        let pattern_clean = pattern_lower.trim_end_matches('*');
                        app_lower.starts_with(&pattern_clean)
                    } else {
                        app_lower.contains(&pattern_lower)
                    }
                }
                "window_title" => {
                    if let Some(title) = window_title {
                        let title_lower = title.to_lowercase();
                        let pattern_lower = pattern.to_lowercase();
                        
                        if pattern_lower.starts_with('*') && pattern_lower.ends_with('*') {
                            let pattern_clean = pattern_lower.trim_start_matches('*').trim_end_matches('*');
                            title_lower.contains(&pattern_clean)
                        } else if pattern_lower.starts_with('*') {
                            let pattern_clean = pattern_lower.trim_start_matches('*');
                            title_lower.ends_with(&pattern_clean)
                        } else if pattern_lower.ends_with('*') {
                            let pattern_clean = pattern_lower.trim_end_matches('*');
                            title_lower.starts_with(&pattern_clean)
                        } else {
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
                        
                        if pattern_lower.starts_with('*') && pattern_lower.ends_with('*') {
                            let pattern_clean = pattern_lower.trim_start_matches('*').trim_end_matches('*');
                            domain_lower.contains(&pattern_clean)
                        } else if pattern_lower.starts_with('*') {
                            let pattern_clean = pattern_lower.trim_start_matches('*');
                            domain_lower.ends_with(&pattern_clean)
                        } else if pattern_lower.ends_with('*') {
                            let pattern_clean = pattern_lower.trim_end_matches('*');
                            domain_lower.starts_with(&pattern_clean)
                        } else {
                            domain_lower.contains(&pattern_lower)
                        }
                    } else {
                        false
                    }
                }
                _ => false,
            };

            if matches {
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
            }
        }

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
            None
        }
    }

    /// Record idle start time
    pub fn record_idle_start(&self, timestamp: i64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        
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
            "INSERT INTO activities (app_name, window_title, domain, category_id, started_at, duration_sec, is_idle)
             VALUES ('Idle', NULL, NULL, ?, ?, 0, TRUE)",
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

    /// Get activities for a time range with optional pagination and filters
    pub fn get_activities(
        &self,
        start: i64,
        end: i64,
        limit: Option<i64>,
        offset: Option<i64>,
        exclude_idle: Option<bool>,
        category_ids: Option<&[i64]>,
    ) -> Result<Vec<Activity>> {
        let conn = self.conn.lock().unwrap();
        
        let map_row = |row: &rusqlite::Row| -> Result<Activity> {
            Ok(Activity {
                id: row.get(0)?,
                app_name: row.get(1)?,
                window_title: row.get(2)?,
                domain: row.get(3)?,
                category_id: row.get(4)?,
                started_at: row.get(5)?,
                duration_sec: row.get(6)?,
                is_idle: row.get(7)?,
            })
        };
        
        // Build WHERE clause components
        let mut where_parts: Vec<String> = vec!["started_at >= ?".to_string(), "started_at <= ?".to_string()];
        let mut params_vec: Vec<SqliteValue> = vec![
            SqliteValue::Integer(start),
            SqliteValue::Integer(end),
        ];
        
        if let Some(true) = exclude_idle {
            where_parts.push("is_idle = 0".to_string());
        }
        
        if let Some(ids) = category_ids {
            if !ids.is_empty() {
                let placeholders: Vec<String> = (0..ids.len()).map(|_| "?".to_string()).collect();
                let category_filter = format!("category_id IN ({})", placeholders.join(","));
                where_parts.push(category_filter);
                for id in ids {
                    params_vec.push(SqliteValue::Integer(*id));
                }
            }
        }
        
        let where_clause = where_parts.join(" AND ");
        let mut query = format!(
            "SELECT id, app_name, window_title, domain, category_id, started_at, duration_sec, is_idle
             FROM activities
             WHERE {}
             ORDER BY started_at ASC",
            where_clause
        );
        
        // Add pagination
        match (limit, offset) {
            (Some(limit_val), Some(offset_val)) => {
                query.push_str(" LIMIT ? OFFSET ?");
                params_vec.push(SqliteValue::Integer(limit_val));
                params_vec.push(SqliteValue::Integer(offset_val));
            }
            (Some(limit_val), None) => {
                query.push_str(" LIMIT ?");
                params_vec.push(SqliteValue::Integer(limit_val));
            }
            (None, _) => {}
        }
        
        let mut stmt = conn.prepare(&query)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(params_vec.iter()), map_row)?;
        let activities = rows.collect::<Result<Vec<_>>>()?;

        Ok(activities)
    }

    /// Get activity by ID
    pub fn get_activity_by_id(&self, id: i64) -> Result<Option<Activity>> {
        let conn = self.conn.lock().unwrap();
        conn.query_row(
            "SELECT id, app_name, window_title, domain, category_id, started_at, duration_sec, is_idle
             FROM activities WHERE id = ?",
            params![id],
            |row| {
                Ok(Activity {
                    id: row.get(0)?,
                    app_name: row.get(1)?,
                    window_title: row.get(2)?,
                    domain: row.get(3)?,
                    category_id: row.get(4)?,
                    started_at: row.get(5)?,
                    duration_sec: row.get(6)?,
                    is_idle: row.get(7)?,
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
            
            match category_id {
                Some(cat_id) => {
                    conn.execute(
                        "UPDATE activities SET category_id = ? WHERE id = ?",
                        params![cat_id, id],
                    )?;
                }
                None => {
                    conn.execute(
                        "UPDATE activities SET category_id = NULL WHERE id = ?",
                        params![id],
                    )?;
                }
            }
        }
        
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

        let activities_total: i64 = conn
            .query_row(
                "SELECT COALESCE(SUM(duration_sec), 0) FROM activities WHERE started_at >= ? AND is_idle = FALSE",
                params![today_start],
                |row| row.get(0),
            )
            .unwrap_or(0);

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
}

// Use OptionalExtension from common module
use super::common::OptionalExtension;
