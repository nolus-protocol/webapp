//! Repository for lease downpayment ranges.

use rust_decimal::Decimal;
use sqlx::{PgPool, Row};

use super::models::{LeaseDownpaymentRange, LeaseDownpaymentRangeInput};

/// Repository for lease downpayment range operations.
pub struct LeaseRulesRepo;

impl LeaseRulesRepo {
    /// Get all downpayment ranges.
    pub async fn get_all(pool: &PgPool) -> Result<Vec<LeaseDownpaymentRange>, sqlx::Error> {
        sqlx::query_as::<_, LeaseDownpaymentRange>(
            r#"SELECT id, protocol, asset_ticker, min_amount, max_amount, created_at, updated_at
               FROM lease_downpayment_ranges
               ORDER BY protocol, asset_ticker"#,
        )
        .fetch_all(pool)
        .await
    }

    /// Get downpayment ranges for a specific protocol.
    pub async fn get_by_protocol(
        pool: &PgPool,
        protocol: &str,
    ) -> Result<Vec<LeaseDownpaymentRange>, sqlx::Error> {
        sqlx::query_as::<_, LeaseDownpaymentRange>(
            r#"SELECT id, protocol, asset_ticker, min_amount, max_amount, created_at, updated_at
               FROM lease_downpayment_ranges
               WHERE protocol = $1
               ORDER BY asset_ticker"#,
        )
        .bind(protocol)
        .fetch_all(pool)
        .await
    }

    /// Get downpayment range for a specific protocol and asset.
    pub async fn get_by_protocol_and_asset(
        pool: &PgPool,
        protocol: &str,
        asset_ticker: &str,
    ) -> Result<Option<LeaseDownpaymentRange>, sqlx::Error> {
        sqlx::query_as::<_, LeaseDownpaymentRange>(
            r#"SELECT id, protocol, asset_ticker, min_amount, max_amount, created_at, updated_at
               FROM lease_downpayment_ranges
               WHERE protocol = $1 AND asset_ticker = $2"#,
        )
        .bind(protocol)
        .bind(asset_ticker)
        .fetch_optional(pool)
        .await
    }

    /// Get min/max amounts for a specific protocol and asset.
    pub async fn get_range(
        pool: &PgPool,
        protocol: &str,
        asset_ticker: &str,
    ) -> Result<Option<(Decimal, Decimal)>, sqlx::Error> {
        let result = Self::get_by_protocol_and_asset(pool, protocol, asset_ticker).await?;
        Ok(result.map(|r| (r.min_amount, r.max_amount)))
    }

    /// Insert or update a downpayment range.
    pub async fn upsert(
        pool: &PgPool,
        input: &LeaseDownpaymentRangeInput,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO lease_downpayment_ranges (protocol, asset_ticker, min_amount, max_amount)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (protocol, asset_ticker) DO UPDATE SET
               min_amount = EXCLUDED.min_amount,
               max_amount = EXCLUDED.max_amount,
               updated_at = NOW()"#,
        )
        .bind(&input.protocol)
        .bind(&input.asset_ticker)
        .bind(&input.min_amount)
        .bind(&input.max_amount)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Upsert multiple ranges in a batch.
    pub async fn upsert_batch(
        pool: &PgPool,
        inputs: &[LeaseDownpaymentRangeInput],
    ) -> Result<(), sqlx::Error> {
        let mut tx = pool.begin().await?;

        for input in inputs {
            sqlx::query(
                r#"INSERT INTO lease_downpayment_ranges (protocol, asset_ticker, min_amount, max_amount)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (protocol, asset_ticker) DO UPDATE SET
                   min_amount = EXCLUDED.min_amount,
                   max_amount = EXCLUDED.max_amount,
                   updated_at = NOW()"#,
            )
            .bind(&input.protocol)
            .bind(&input.asset_ticker)
            .bind(&input.min_amount)
            .bind(&input.max_amount)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    /// Delete a downpayment range by ID.
    pub async fn delete(pool: &PgPool, id: i32) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM lease_downpayment_ranges WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Delete all ranges for a protocol.
    pub async fn delete_by_protocol(pool: &PgPool, protocol: &str) -> Result<u64, sqlx::Error> {
        let result = sqlx::query("DELETE FROM lease_downpayment_ranges WHERE protocol = $1")
            .bind(protocol)
            .execute(pool)
            .await?;
        Ok(result.rows_affected())
    }

    /// Get all unique protocols that have downpayment ranges.
    pub async fn get_protocols(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
        let rows = sqlx::query(
            r#"SELECT DISTINCT protocol FROM lease_downpayment_ranges ORDER BY protocol"#,
        )
        .fetch_all(pool)
        .await?;
        Ok(rows
            .into_iter()
            .map(|r| r.get::<String, _>(0))
            .collect())
    }
}
