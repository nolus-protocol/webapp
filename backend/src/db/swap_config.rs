//! Repository for swap configuration.

use sqlx::{PgPool, Row};

use super::models::{SwapConfigEntry, SwapVenue, SwapVenueInput};

/// Common config keys for swap settings.
pub mod keys {
    pub const API_URL: &str = "api_url";
    pub const GAS_MULTIPLIER: &str = "gas_multiplier";
    pub const FEE: &str = "fee";
    pub const TIMEOUT_SECONDS: &str = "timeout_seconds";
    pub const SLIPPAGE: &str = "slippage";
}

/// Repository for swap configuration key-value operations.
pub struct SwapConfigRepo;

impl SwapConfigRepo {
    /// Get all swap config entries.
    pub async fn get_all(pool: &PgPool) -> Result<Vec<SwapConfigEntry>, sqlx::Error> {
        sqlx::query_as::<_, SwapConfigEntry>(
            r#"SELECT key, value, updated_at FROM swap_config ORDER BY key"#,
        )
        .fetch_all(pool)
        .await
    }

    /// Get a config value by key.
    pub async fn get(pool: &PgPool, key: &str) -> Result<Option<String>, sqlx::Error> {
        let row = sqlx::query(r#"SELECT value FROM swap_config WHERE key = $1"#)
            .bind(key)
            .fetch_optional(pool)
            .await?;
        Ok(row.map(|r| r.get::<String, _>(0)))
    }

    /// Set a config value.
    pub async fn set(pool: &PgPool, key: &str, value: &str) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO swap_config (key, value)
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

    /// Delete a config entry.
    pub async fn delete(pool: &PgPool, key: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM swap_config WHERE key = $1")
            .bind(key)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Get config as a map.
    pub async fn get_as_map(
        pool: &PgPool,
    ) -> Result<std::collections::HashMap<String, String>, sqlx::Error> {
        let entries = Self::get_all(pool).await?;
        Ok(entries.into_iter().map(|e| (e.key, e.value)).collect())
    }
}

/// Repository for swap venue operations.
pub struct SwapVenueRepo;

impl SwapVenueRepo {
    /// Get all venues.
    pub async fn get_all(pool: &PgPool) -> Result<Vec<SwapVenue>, sqlx::Error> {
        sqlx::query_as::<_, SwapVenue>(
            r#"SELECT id, name, chain_id, address, is_active, created_at
               FROM swap_venues
               ORDER BY name"#,
        )
        .fetch_all(pool)
        .await
    }

    /// Get active venues.
    pub async fn get_active(pool: &PgPool) -> Result<Vec<SwapVenue>, sqlx::Error> {
        sqlx::query_as::<_, SwapVenue>(
            r#"SELECT id, name, chain_id, address, is_active, created_at
               FROM swap_venues
               WHERE is_active = TRUE
               ORDER BY name"#,
        )
        .fetch_all(pool)
        .await
    }

    /// Get a venue by ID.
    pub async fn get_by_id(pool: &PgPool, id: i32) -> Result<Option<SwapVenue>, sqlx::Error> {
        sqlx::query_as::<_, SwapVenue>(
            r#"SELECT id, name, chain_id, address, is_active, created_at
               FROM swap_venues
               WHERE id = $1"#,
        )
        .bind(id)
        .fetch_optional(pool)
        .await
    }

    /// Create a new venue.
    pub async fn create(pool: &PgPool, input: &SwapVenueInput) -> Result<SwapVenue, sqlx::Error> {
        sqlx::query_as::<_, SwapVenue>(
            r#"INSERT INTO swap_venues (name, chain_id, address)
               VALUES ($1, $2, $3)
               RETURNING id, name, chain_id, address, is_active, created_at"#,
        )
        .bind(&input.name)
        .bind(&input.chain_id)
        .bind(&input.address)
        .fetch_one(pool)
        .await
    }

    /// Update venue active status.
    pub async fn set_active(pool: &PgPool, id: i32, is_active: bool) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("UPDATE swap_venues SET is_active = $1 WHERE id = $2")
            .bind(is_active)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Delete a venue.
    pub async fn delete(pool: &PgPool, id: i32) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM swap_venues WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }
}
