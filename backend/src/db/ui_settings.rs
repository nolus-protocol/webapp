//! Repository for UI settings.

use serde_json::Value as JsonValue;
use sqlx::{PgPool, Row};

use super::models::UiSettingsEntry;

/// Common setting keys.
pub mod keys {
    pub const HIDDEN_PROPOSALS: &str = "hidden_proposals";
    pub const MAINTENANCE_MODE: &str = "maintenance_mode";
    pub const DUE_PROJECTION_SECS: &str = "due_projection_secs";
}

/// Repository for UI settings operations.
pub struct UiSettingsRepo;

impl UiSettingsRepo {
    /// Get all UI settings.
    pub async fn get_all(pool: &PgPool) -> Result<Vec<UiSettingsEntry>, sqlx::Error> {
        sqlx::query_as::<_, UiSettingsEntry>(
            r#"SELECT key, value, updated_at FROM ui_settings ORDER BY key"#,
        )
        .fetch_all(pool)
        .await
    }

    /// Get a setting by key.
    pub async fn get(pool: &PgPool, key: &str) -> Result<Option<JsonValue>, sqlx::Error> {
        let row = sqlx::query(r#"SELECT value FROM ui_settings WHERE key = $1"#)
            .bind(key)
            .fetch_optional(pool)
            .await?;
        Ok(row.map(|r| r.get::<JsonValue, _>(0)))
    }

    /// Set a setting value.
    pub async fn set(pool: &PgPool, key: &str, value: &JsonValue) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO ui_settings (key, value)
               VALUES ($1, $2)
               ON CONFLICT (key) DO UPDATE SET
               value = EXCLUDED.value,
               updated_at = NOW()"#,
        )
        .bind(key)
        .bind(value)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Delete a setting.
    pub async fn delete(pool: &PgPool, key: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM ui_settings WHERE key = $1")
            .bind(key)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Get hidden proposals list.
    pub async fn get_hidden_proposals(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
        let value = Self::get(pool, keys::HIDDEN_PROPOSALS).await?;
        match value {
            Some(v) => {
                let proposals: Vec<String> = serde_json::from_value(v).unwrap_or_default();
                Ok(proposals)
            }
            None => Ok(Vec::new()),
        }
    }

    /// Set hidden proposals list.
    pub async fn set_hidden_proposals(
        pool: &PgPool,
        proposals: &[String],
    ) -> Result<(), sqlx::Error> {
        let value = serde_json::to_value(proposals).unwrap_or(JsonValue::Array(vec![]));
        Self::set(pool, keys::HIDDEN_PROPOSALS, &value).await
    }

    /// Check if maintenance mode is enabled.
    pub async fn is_maintenance_mode(pool: &PgPool) -> Result<bool, sqlx::Error> {
        let value = Self::get(pool, keys::MAINTENANCE_MODE).await?;
        match value {
            Some(v) => Ok(v.as_bool().unwrap_or(false)),
            None => Ok(false),
        }
    }

    /// Set maintenance mode.
    pub async fn set_maintenance_mode(pool: &PgPool, enabled: bool) -> Result<(), sqlx::Error> {
        Self::set(pool, keys::MAINTENANCE_MODE, &JsonValue::Bool(enabled)).await
    }

    /// Get due projection seconds.
    pub async fn get_due_projection_secs(pool: &PgPool) -> Result<Option<i64>, sqlx::Error> {
        let value = Self::get(pool, keys::DUE_PROJECTION_SECS).await?;
        match value {
            Some(v) => Ok(v.as_i64()),
            None => Ok(None),
        }
    }

    /// Set due projection seconds.
    pub async fn set_due_projection_secs(pool: &PgPool, secs: i64) -> Result<(), sqlx::Error> {
        Self::set(
            pool,
            keys::DUE_PROJECTION_SECS,
            &JsonValue::Number(secs.into()),
        )
        .await
    }
}
