//! Repository for network configuration data.

use sqlx::{PgPool, Row};

use super::models::{NetworkConfig, NetworkConfigInput, NetworkEndpoint, NetworkEndpointInput};

/// Repository for network configuration operations.
pub struct NetworkConfigRepo;

impl NetworkConfigRepo {
    /// Get all network configurations.
    pub async fn get_all(pool: &PgPool) -> Result<Vec<NetworkConfig>, sqlx::Error> {
        sqlx::query_as::<_, NetworkConfig>(
            r#"SELECT network_key, explorer_url, gas_price, gas_multiplier, primary_protocol, created_at, updated_at
               FROM network_config
               ORDER BY network_key"#,
        )
        .fetch_all(pool)
        .await
    }

    /// Get a network configuration by key.
    pub async fn get_by_key(
        pool: &PgPool,
        network_key: &str,
    ) -> Result<Option<NetworkConfig>, sqlx::Error> {
        sqlx::query_as::<_, NetworkConfig>(
            r#"SELECT network_key, explorer_url, gas_price, gas_multiplier, primary_protocol, created_at, updated_at
               FROM network_config
               WHERE network_key = $1"#,
        )
        .bind(network_key)
        .fetch_optional(pool)
        .await
    }

    /// Check if a network is configured.
    pub async fn is_configured(pool: &PgPool, network_key: &str) -> Result<bool, sqlx::Error> {
        let result: (bool,) =
            sqlx::query_as(r#"SELECT EXISTS(SELECT 1 FROM network_config WHERE network_key = $1)"#)
                .bind(network_key)
                .fetch_one(pool)
                .await?;
        Ok(result.0)
    }

    /// Insert or update a network configuration.
    pub async fn upsert(pool: &PgPool, input: &NetworkConfigInput) -> Result<(), sqlx::Error> {
        let gas_multiplier = input
            .gas_multiplier
            .unwrap_or_else(|| rust_decimal::Decimal::new(15, 1)); // 1.5
        sqlx::query(
            r#"INSERT INTO network_config (network_key, explorer_url, gas_price, gas_multiplier, primary_protocol)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (network_key) DO UPDATE SET
               explorer_url = EXCLUDED.explorer_url,
               gas_price = EXCLUDED.gas_price,
               gas_multiplier = EXCLUDED.gas_multiplier,
               primary_protocol = EXCLUDED.primary_protocol,
               updated_at = NOW()"#,
        )
        .bind(&input.network_key)
        .bind(&input.explorer_url)
        .bind(&input.gas_price)
        .bind(&gas_multiplier)
        .bind(&input.primary_protocol)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Delete a network configuration.
    pub async fn delete(pool: &PgPool, network_key: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM network_config WHERE network_key = $1")
            .bind(network_key)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Get the primary protocol for a network (used for price deduplication).
    pub async fn get_primary_protocol(
        pool: &PgPool,
        network_key: &str,
    ) -> Result<Option<String>, sqlx::Error> {
        let row = sqlx::query(r#"SELECT primary_protocol FROM network_config WHERE network_key = $1"#)
            .bind(network_key)
            .fetch_optional(pool)
            .await?;
        Ok(row.and_then(|r| r.get::<Option<String>, _>(0)))
    }
}

/// Repository for network endpoint operations.
pub struct NetworkEndpointRepo;

impl NetworkEndpointRepo {
    /// Get all endpoints for a network.
    pub async fn get_by_network(
        pool: &PgPool,
        network_key: &str,
    ) -> Result<Vec<NetworkEndpoint>, sqlx::Error> {
        sqlx::query_as::<_, NetworkEndpoint>(
            r#"SELECT id, network_key, endpoint_type, url, priority, is_active, created_at
               FROM network_endpoints
               WHERE network_key = $1
               ORDER BY priority, id"#,
        )
        .bind(network_key)
        .fetch_all(pool)
        .await
    }

    /// Get active endpoints for a network by type.
    pub async fn get_active_by_type(
        pool: &PgPool,
        network_key: &str,
        endpoint_type: &str,
    ) -> Result<Vec<NetworkEndpoint>, sqlx::Error> {
        sqlx::query_as::<_, NetworkEndpoint>(
            r#"SELECT id, network_key, endpoint_type, url, priority, is_active, created_at
               FROM network_endpoints
               WHERE network_key = $1 AND endpoint_type = $2 AND is_active = TRUE
               ORDER BY priority, id"#,
        )
        .bind(network_key)
        .bind(endpoint_type)
        .fetch_all(pool)
        .await
    }

    /// Add an endpoint.
    pub async fn create(
        pool: &PgPool,
        input: &NetworkEndpointInput,
    ) -> Result<NetworkEndpoint, sqlx::Error> {
        let priority = input.priority.unwrap_or(0);
        sqlx::query_as::<_, NetworkEndpoint>(
            r#"INSERT INTO network_endpoints (network_key, endpoint_type, url, priority)
               VALUES ($1, $2, $3, $4)
               RETURNING id, network_key, endpoint_type, url, priority, is_active, created_at"#,
        )
        .bind(&input.network_key)
        .bind(&input.endpoint_type)
        .bind(&input.url)
        .bind(priority)
        .fetch_one(pool)
        .await
    }

    /// Update endpoint active status.
    pub async fn set_active(pool: &PgPool, id: i32, is_active: bool) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("UPDATE network_endpoints SET is_active = $1 WHERE id = $2")
            .bind(is_active)
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Delete an endpoint.
    pub async fn delete(pool: &PgPool, id: i32) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM network_endpoints WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Delete all endpoints for a network.
    pub async fn delete_by_network(pool: &PgPool, network_key: &str) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM network_endpoints WHERE network_key = $1")
            .bind(network_key)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// Replace all endpoints for a network.
    pub async fn replace_all(
        pool: &PgPool,
        network_key: &str,
        endpoints: &[NetworkEndpointInput],
    ) -> Result<(), sqlx::Error> {
        let mut tx = pool.begin().await?;

        // Delete existing endpoints
        sqlx::query("DELETE FROM network_endpoints WHERE network_key = $1")
            .bind(network_key)
            .execute(&mut *tx)
            .await?;

        // Insert new endpoints
        for (i, endpoint) in endpoints.iter().enumerate() {
            let priority = endpoint.priority.unwrap_or(i as i32);
            sqlx::query(
                r#"INSERT INTO network_endpoints (network_key, endpoint_type, url, priority)
                   VALUES ($1, $2, $3, $4)"#,
            )
            .bind(network_key)
            .bind(&endpoint.endpoint_type)
            .bind(&endpoint.url)
            .bind(priority)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }
}
