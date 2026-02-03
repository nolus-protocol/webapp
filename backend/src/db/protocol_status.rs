//! Repository for protocol status (configured, blacklisted, unconfigured).

use chrono::{DateTime, Utc};
use sqlx::{PgPool, Row};

use super::models::{protocol_statuses, ProtocolStatus, ProtocolStatusInput};

/// Repository for protocol status operations.
pub struct ProtocolStatusRepo;

impl ProtocolStatusRepo {
    /// Get all protocol statuses.
    pub async fn get_all(pool: &PgPool) -> Result<Vec<ProtocolStatus>, sqlx::Error> {
        sqlx::query_as::<_, ProtocolStatus>(
            r#"SELECT protocol, status, reason, configured_at, created_at, updated_at
               FROM protocol_status
               ORDER BY protocol"#,
        )
        .fetch_all(pool)
        .await
    }

    /// Get a protocol status by name.
    pub async fn get(pool: &PgPool, protocol: &str) -> Result<Option<ProtocolStatus>, sqlx::Error> {
        sqlx::query_as::<_, ProtocolStatus>(
            r#"SELECT protocol, status, reason, configured_at, created_at, updated_at
               FROM protocol_status
               WHERE protocol = $1"#,
        )
        .bind(protocol)
        .fetch_optional(pool)
        .await
    }

    /// Get all protocols with a specific status.
    pub async fn get_by_status(
        pool: &PgPool,
        status: &str,
    ) -> Result<Vec<ProtocolStatus>, sqlx::Error> {
        sqlx::query_as::<_, ProtocolStatus>(
            r#"SELECT protocol, status, reason, configured_at, created_at, updated_at
               FROM protocol_status
               WHERE status = $1
               ORDER BY protocol"#,
        )
        .bind(status)
        .fetch_all(pool)
        .await
    }

    /// Check if a protocol is configured.
    pub async fn is_configured(pool: &PgPool, protocol: &str) -> Result<bool, sqlx::Error> {
        let result: (bool,) = sqlx::query_as(
            r#"SELECT COALESCE(status = 'configured', FALSE) 
               FROM protocol_status 
               WHERE protocol = $1"#,
        )
        .bind(protocol)
        .fetch_optional(pool)
        .await?
        .unwrap_or((false,));
        Ok(result.0)
    }

    /// Check if a protocol is blacklisted.
    pub async fn is_blacklisted(pool: &PgPool, protocol: &str) -> Result<bool, sqlx::Error> {
        let result: (bool,) = sqlx::query_as(
            r#"SELECT COALESCE(status = 'blacklisted', FALSE) 
               FROM protocol_status 
               WHERE protocol = $1"#,
        )
        .bind(protocol)
        .fetch_optional(pool)
        .await?
        .unwrap_or((false,));
        Ok(result.0)
    }

    /// Get status string for a protocol (returns 'unconfigured' if not in DB).
    pub async fn get_status(pool: &PgPool, protocol: &str) -> Result<String, sqlx::Error> {
        let row = sqlx::query(r#"SELECT status FROM protocol_status WHERE protocol = $1"#)
            .bind(protocol)
            .fetch_optional(pool)
            .await?;
        Ok(row
            .map(|r| r.get::<String, _>(0))
            .unwrap_or_else(|| protocol_statuses::UNCONFIGURED.to_string()))
    }

    /// Insert or update a protocol status.
    pub async fn upsert(pool: &PgPool, input: &ProtocolStatusInput) -> Result<(), sqlx::Error> {
        let configured_at: Option<DateTime<Utc>> = if input.status == protocol_statuses::CONFIGURED
        {
            Some(Utc::now())
        } else {
            None
        };

        sqlx::query(
            r#"INSERT INTO protocol_status (protocol, status, reason, configured_at)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (protocol) DO UPDATE SET
               status = EXCLUDED.status,
               reason = EXCLUDED.reason,
               configured_at = CASE 
                   WHEN EXCLUDED.status = 'configured' AND protocol_status.status != 'configured' 
                   THEN NOW() 
                   ELSE protocol_status.configured_at 
               END,
               updated_at = NOW()"#,
        )
        .bind(&input.protocol)
        .bind(&input.status)
        .bind(&input.reason)
        .bind(configured_at)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Set a protocol as configured.
    pub async fn set_configured(
        pool: &PgPool,
        protocol: &str,
        reason: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        Self::upsert(
            pool,
            &ProtocolStatusInput {
                protocol: protocol.to_string(),
                status: protocol_statuses::CONFIGURED.to_string(),
                reason: reason.map(String::from),
            },
        )
        .await
    }

    /// Set a protocol as blacklisted.
    pub async fn set_blacklisted(
        pool: &PgPool,
        protocol: &str,
        reason: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        Self::upsert(
            pool,
            &ProtocolStatusInput {
                protocol: protocol.to_string(),
                status: protocol_statuses::BLACKLISTED.to_string(),
                reason: reason.map(String::from),
            },
        )
        .await
    }

    /// Delete a protocol status (sets it back to unconfigured).
    pub async fn delete(pool: &PgPool, protocol: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM protocol_status WHERE protocol = $1")
            .bind(protocol)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Get all configured protocol names.
    pub async fn get_configured_protocols(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
        let rows = sqlx::query(
            r#"SELECT protocol FROM protocol_status WHERE status = 'configured' ORDER BY protocol"#,
        )
        .fetch_all(pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| r.get::<String, _>(0))
            .collect())
    }

    /// Get all blacklisted protocol names.
    pub async fn get_blacklisted_protocols(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
        let rows = sqlx::query(
            r#"SELECT protocol FROM protocol_status WHERE status = 'blacklisted' ORDER BY protocol"#,
        )
        .fetch_all(pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| r.get::<String, _>(0))
            .collect())
    }
}
