//! Generic CRUD and aggregation for plugin-created tables.
//! Table and column names are validated (alphanumeric + underscore only).

use super::common::{Database, OptionalExtension};
use rusqlite::params;
use rusqlite::types::Value as SqliteValue;

/// Allowed characters for table and column identifiers (SQL injection prevention)
fn is_valid_identifier(s: &str) -> bool {
    !s.is_empty()
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// Get auto-timestamp column names for a plugin table, if any.
fn get_plugin_auto_timestamps(conn: &rusqlite::Connection, table: &str) -> Result<(Option<String>, Option<String>), String> {
    let row = conn
        .query_row(
            "SELECT created_at_col, updated_at_col FROM plugin_auto_timestamps WHERE table_name = ?",
            params![table],
            |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .optional()
        .map_err(|e| format!("Failed to get auto timestamps: {}", e))?;
    Ok(row.unwrap_or((None, None)))
}

/// Get column names for a table from sqlite_master / pragma_table_info
fn get_table_columns(conn: &rusqlite::Connection, table: &str) -> Result<Vec<String>, String> {
    let query = format!("PRAGMA table_info(\"{}\")", table.replace('"', "\"\""));
    let mut stmt = conn
        .prepare(&query)
        .map_err(|e| format!("Failed to get table info: {}", e))?;
    let columns: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|e| format!("Failed to query table info: {}", e))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(columns)
}

/// Convert rusqlite Value to serde_json::Value
fn sqlite_value_to_json(v: SqliteValue) -> serde_json::Value {
    match v {
        SqliteValue::Integer(i) => serde_json::json!(i),
        SqliteValue::Real(f) => serde_json::json!(f),
        SqliteValue::Text(s) => serde_json::json!(s),
        SqliteValue::Blob(_) => serde_json::Value::Null,
        SqliteValue::Null => serde_json::Value::Null,
    }
}

/// Core category column names (used to distinguish extended columns)
const CORE_CATEGORY_COLUMNS: &[&str] = &[
    "id", "name", "color", "icon", "is_productive", "sort_order", "is_system", "is_pinned",
];

impl Database {
    /// Get all categories as JSON objects including plugin-extended columns.
    /// Used by the plugin API so plugins can read/write extended fields.
    pub fn get_categories_as_json(&self) -> Result<Vec<serde_json::Value>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let columns = get_table_columns(&conn, "categories")?;
        if columns.is_empty() {
            return Ok(Vec::new());
        }
        let columns_str = columns
            .iter()
            .map(|c| format!("\"{}\"", c.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!(
            "SELECT {} FROM categories ORDER BY sort_order ASC",
            columns_str
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                let mut obj = serde_json::Map::new();
                for (i, col) in columns.iter().enumerate() {
                    let val: SqliteValue = row.get(i)?;
                    obj.insert(col.clone(), sqlite_value_to_json(val));
                }
                Ok(serde_json::Value::Object(obj))
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    /// Update only plugin-extended columns on a category row. Core columns are not updated.
    pub fn update_categories_extended(
        &self,
        id: i64,
        data: &serde_json::Map<String, serde_json::Value>,
    ) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let all_columns = get_table_columns(&conn, "categories")?;
        let extended: Vec<&String> = all_columns
            .iter()
            .filter(|c| !CORE_CATEGORY_COLUMNS.contains(&c.as_str()))
            .collect();
        let data_filtered: serde_json::Map<String, serde_json::Value> = data
            .iter()
            .filter(|(k, _)| is_valid_identifier(k) && extended.iter().any(|c| *c == *k))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();
        if data_filtered.is_empty() {
            return Ok(0);
        }
        let set_parts: Vec<String> = data_filtered
            .keys()
            .map(|k| format!("\"{}\" = ?", k.replace('"', "\"\"")))
            .collect();
        let sql = format!(
            "UPDATE categories SET {} WHERE id = ?",
            set_parts.join(", ")
        );
        let mut param_values: Vec<SqliteValue> = data_filtered
            .keys()
            .filter_map(|k| data_filtered.get(k))
            .map(json_to_sqlite_value)
            .collect();
        param_values.push(SqliteValue::Integer(id));
        let n = conn
            .execute(&sql, rusqlite::params_from_iter(param_values.iter()))
            .map_err(|e| e.to_string())?;
        Ok(n)
    }

    /// Insert a row into a plugin table. Returns the new row id.
    /// `data` keys must be valid column names; values are bound as parameters.
    /// If the table has auto-timestamp columns (created_at/updated_at), they are set automatically when not provided.
    pub fn plugin_insert_table(
        &self,
        table: &str,
        data: &serde_json::Map<String, serde_json::Value>,
    ) -> Result<i64, String> {
        if !is_valid_identifier(table) {
            return Err("Invalid table name".to_string());
        }
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let (created_col, updated_col) = get_plugin_auto_timestamps(&conn, table)?;
        let now = chrono::Utc::now().timestamp();
        let mut data = data.clone();
        if let Some(c) = &created_col {
            if !data.contains_key(c) {
                data.insert(c.clone(), serde_json::json!(now));
            }
        }
        if let Some(u) = &updated_col {
            if !data.contains_key(u) {
                data.insert(u.clone(), serde_json::json!(now));
            }
        }
        let columns: Vec<&str> = data
            .keys()
            .map(|k| k.as_str())
            .filter(|k| is_valid_identifier(k))
            .collect();
        if columns.is_empty() {
            return Err("No valid columns provided".to_string());
        }
        let placeholders = columns.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
        let columns_str = columns.join(", ");
        let sql = format!(
            "INSERT INTO \"{}\" ({}) VALUES ({})",
            table.replace('"', "\"\""),
            columns_str,
            placeholders
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let param_values: Vec<SqliteValue> = columns
            .iter()
            .map(|c| {
                data.get(*c)
                    .map_or(SqliteValue::Null, json_to_sqlite_value)
            })
            .collect();
        stmt.execute(rusqlite::params_from_iter(param_values.iter()))
            .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }

    /// Select rows from a plugin table with optional filters, order_by, and limit.
    pub fn plugin_select_table(
        &self,
        table: &str,
        filters: Option<&serde_json::Map<String, serde_json::Value>>,
        order_by: Option<&str>,
        limit: Option<i64>,
    ) -> Result<Vec<serde_json::Value>, String> {
        if !is_valid_identifier(table) {
            return Err("Invalid table name".to_string());
        }
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let columns = get_table_columns(&conn, table)?;
        if columns.is_empty() {
            return Err("Table has no columns".to_string());
        }
        for c in &columns {
            if !is_valid_identifier(c) {
                return Err("Invalid column name in table".to_string());
            }
        }
        let columns_str = columns.join(", ");
        let mut sql = format!(
            "SELECT {} FROM \"{}\"",
            columns_str,
            table.replace('"', "\"\"")
        );
        let mut params_vec: Vec<SqliteValue> = Vec::new();
        if let Some(f) = filters {
            let conds: Vec<String> = f
                .keys()
                .filter(|k| is_valid_identifier(k))
                .map(|k| format!("\"{}\" = ?", k.replace('"', "\"\"")))
                .collect();
            if !conds.is_empty() {
                sql.push_str(" WHERE ");
                sql.push_str(&conds.join(" AND "));
                for k in f.keys().filter(|k| is_valid_identifier(k)) {
                    if let Some(v) = f.get(k) {
                        params_vec.push(json_to_sqlite_value(v));
                    }
                }
            }
        }
        if let Some(ob) = order_by {
            let ob = ob.trim();
            let (col, dir): (&str, &str) = match ob.split_whitespace().collect::<Vec<_>>().as_slice() {
                [c] if is_valid_identifier(c) => (c, "ASC"),
                [c, d] if is_valid_identifier(c) && (*d == "ASC" || *d == "DESC") => (c, d),
                _ => ("", ""),
            };
            if !col.is_empty() {
                sql.push_str(&format!(
                    " ORDER BY \"{}\" {}",
                    col.replace('"', "\"\""),
                    dir
                ));
            }
        }
        if let Some(l) = limit {
            if l > 0 && l <= 10000 {
                sql.push_str(&format!(" LIMIT {}", l));
            }
        }
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params_from_iter(params_vec.iter()), |row| {
                let mut obj = serde_json::Map::new();
                for (i, col) in columns.iter().enumerate() {
                    let val: SqliteValue = row.get(i)?;
                    obj.insert(col.clone(), sqlite_value_to_json(val));
                }
                Ok(serde_json::Value::Object(obj))
            })
            .map_err(|e| e.to_string())?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row.map_err(|e| e.to_string())?);
        }
        Ok(out)
    }

    /// Update a row in a plugin table by id. Returns number of rows updated.
    /// If the table has an auto-updated timestamp column (updated_at), it is set automatically when not provided.
    pub fn plugin_update_table(
        &self,
        table: &str,
        id: i64,
        data: &serde_json::Map<String, serde_json::Value>,
    ) -> Result<usize, String> {
        if !is_valid_identifier(table) {
            return Err("Invalid table name".to_string());
        }
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let (_, updated_col) = get_plugin_auto_timestamps(&conn, table)?;
        let mut data = data.clone();
        if let Some(u) = &updated_col {
            if !data.contains_key(u) {
                data.insert(u.clone(), serde_json::json!(chrono::Utc::now().timestamp()));
            }
        }
        let set_parts: Vec<String> = data
            .keys()
            .filter(|k| is_valid_identifier(k) && *k != "id")
            .map(|k| format!("\"{}\" = ?", k.replace('"', "\"\"")))
            .collect();
        if set_parts.is_empty() {
            return Ok(0);
        }
        let sql = format!(
            "UPDATE \"{}\" SET {} WHERE id = ?",
            table.replace('"', "\"\""),
            set_parts.join(", ")
        );
        let mut param_values: Vec<SqliteValue> = data
            .keys()
            .filter(|k| is_valid_identifier(k) && *k != "id")
            .filter_map(|k| data.get(k))
            .map(json_to_sqlite_value)
            .collect();
        param_values.push(SqliteValue::Integer(id));
        let n = conn
            .execute(&sql, rusqlite::params_from_iter(param_values.iter()))
            .map_err(|e| e.to_string())?;
        Ok(n)
    }

    /// Delete a row from a plugin table by id. Returns number of rows deleted.
    pub fn plugin_delete_table(&self, table: &str, id: i64) -> Result<usize, String> {
        if !is_valid_identifier(table) {
            return Err("Invalid table name".to_string());
        }
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let sql = format!("DELETE FROM \"{}\" WHERE id = ?", table.replace('"', "\"\""));
        let n = conn.execute(&sql, params![id]).map_err(|e| e.to_string())?;
        Ok(n)
    }

    /// Run aggregations on a plugin table (count, sum, avg, min, max, group_by).
    pub fn plugin_aggregate_table(
        &self,
        table: &str,
        filters: Option<&serde_json::Map<String, serde_json::Value>>,
        aggregations: &serde_json::Map<String, serde_json::Value>,
    ) -> Result<serde_json::Value, String> {
        if !is_valid_identifier(table) {
            return Err("Invalid table name".to_string());
        }
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut result = serde_json::Map::new();

        let count_expr = aggregations
            .get("count")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let sum_col = aggregations.get("sum").and_then(|v| v.as_str());
        let avg_col = aggregations.get("avg").and_then(|v| v.as_str());
        let min_col = aggregations.get("min").and_then(|v| v.as_str());
        let max_col = aggregations.get("max").and_then(|v| v.as_str());
        let group_by_arr = aggregations.get("group_by").and_then(|v| v.as_array());

        let mut params_vec: Vec<SqliteValue> = Vec::new();
        let mut where_clause = String::new();
        if let Some(f) = filters {
            let conds: Vec<String> = f
                .keys()
                .filter(|k| is_valid_identifier(k))
                .map(|k| format!("\"{}\" = ?", k.replace('"', "\"\"")))
                .collect();
            if !conds.is_empty() {
                where_clause = format!(" WHERE {}", conds.join(" AND "));
                for k in f.keys().filter(|k| is_valid_identifier(k)) {
                    if let Some(v) = f.get(k) {
                        params_vec.push(json_to_sqlite_value(v));
                    }
                }
            }
        }

        let table_esc = table.replace('"', "\"\"");
        let safe = |s: &str| is_valid_identifier(s);

        if !count_expr.is_empty() {
            let expr = if count_expr == "*" {
                "COUNT(*)".to_string()
            } else if safe(count_expr) {
                format!("COUNT(\"{}\")", count_expr.replace('"', "\"\""))
            } else {
                "COUNT(*)".to_string()
            };
            let sql = format!(
                "SELECT {} FROM \"{}\"{}",
                expr, table_esc, where_clause
            );
            let count: i64 = conn
                .query_row(
                    &sql,
                    rusqlite::params_from_iter(params_vec.iter()),
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            result.insert("total_count".to_string(), serde_json::json!(count));
        }

        if let Some(col) = sum_col.filter(|c| safe(c)) {
            let sql = format!(
                "SELECT COALESCE(SUM(\"{}\"), 0) FROM \"{}\"{}",
                col.replace('"', "\"\""),
                table_esc,
                where_clause
            );
            let sum: Option<i64> = conn
                .query_row(
                    &sql,
                    rusqlite::params_from_iter(params_vec.iter()),
                    |row| row.get(0),
                )
                .ok();
            if let Some(s) = sum {
                result.insert(
                    format!("sum_{}", col),
                    serde_json::json!(s),
                );
            }
        }

        if let Some(col) = avg_col.filter(|c| safe(c)) {
            let sql = format!(
                "SELECT AVG(\"{}\") FROM \"{}\"{}",
                col.replace('"', "\"\""),
                table_esc,
                where_clause
            );
            let avg: Option<f64> = conn
                .query_row(
                    &sql,
                    rusqlite::params_from_iter(params_vec.iter()),
                    |row| row.get(0),
                )
                .ok();
            if let Some(a) = avg {
                result.insert(
                    format!("avg_{}", col),
                    serde_json::json!(a),
                );
            }
        }

        if let Some(col) = min_col.filter(|c| safe(c)) {
            let sql = format!(
                "SELECT MIN(\"{}\") FROM \"{}\"{}",
                col.replace('"', "\"\""),
                table_esc,
                where_clause
            );
            let min_val: Option<i64> = conn
                .query_row(
                    &sql,
                    rusqlite::params_from_iter(params_vec.iter()),
                    |row| row.get(0),
                )
                .ok();
            if let Some(m) = min_val {
                result.insert(format!("min_{}", col), serde_json::json!(m));
            }
        }

        if let Some(col) = max_col.filter(|c| safe(c)) {
            let sql = format!(
                "SELECT MAX(\"{}\") FROM \"{}\"{}",
                col.replace('"', "\"\""),
                table_esc,
                where_clause
            );
            let max_val: Option<i64> = conn
                .query_row(
                    &sql,
                    rusqlite::params_from_iter(params_vec.iter()),
                    |row| row.get(0),
                )
                .ok();
            if let Some(m) = max_val {
                result.insert(format!("max_{}", col), serde_json::json!(m));
            }
        }

        if let Some(gb) = group_by_arr {
            let group_cols: Vec<&str> = gb
                .iter()
                .filter_map(|v| v.as_str())
                .filter(|s| is_valid_identifier(s))
                .collect();
            if !group_cols.is_empty() {
                let gb_str = group_cols
                    .iter()
                    .map(|c| format!("\"{}\"", c.replace('"', "\"\"")))
                    .collect::<Vec<_>>()
                    .join(", ");
                let sql = format!(
                    "SELECT {}, COUNT(*) as _count FROM \"{}\"{} GROUP BY {}",
                    gb_str,
                    table_esc,
                    where_clause,
                    gb_str
                );
                let mut stmt = conn
                    .prepare(&sql)
                    .map_err(|e| e.to_string())?;
                let rows = stmt
                    .query_map(rusqlite::params_from_iter(params_vec.iter()), |row| {
                        let mut obj = serde_json::Map::new();
                        for (i, col) in group_cols.iter().enumerate() {
                            let val: SqliteValue = row.get(i)?;
                            obj.insert(
                                col.to_string(),
                                sqlite_value_to_json(val),
                            );
                        }
                        let count: i64 = row.get(group_cols.len())?;
                        obj.insert("count".to_string(), serde_json::json!(count));
                        Ok(serde_json::Value::Object(obj))
                    })
                    .map_err(|e| e.to_string())?;
                let groups: Vec<serde_json::Value> = rows
                    .filter_map(|r| r.ok())
                    .collect();
                result.insert("groups".to_string(), serde_json::Value::Array(groups));
            }
        }

        Ok(serde_json::Value::Object(result))
    }
}

fn json_to_sqlite_value(v: &serde_json::Value) -> SqliteValue {
    match v {
        serde_json::Value::Null => SqliteValue::Null,
        serde_json::Value::Bool(b) => SqliteValue::Integer(if *b { 1 } else { 0 }),
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                SqliteValue::Integer(i)
            } else if let Some(f) = n.as_f64() {
                SqliteValue::Real(f)
            } else {
                SqliteValue::Null
            }
        }
        serde_json::Value::String(s) => SqliteValue::Text(s.clone()),
        _ => SqliteValue::Null,
    }
}
