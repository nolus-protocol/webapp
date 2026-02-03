//! Repository for asset restrictions (blacklists, disabled assets).

use sqlx::{PgPool, Row};

use super::models::{restriction_types, AssetRestriction, AssetRestrictionInput};

/// Repository for asset restriction operations.
pub struct AssetRestrictionsRepo;

impl AssetRestrictionsRepo {
    /// Get all restrictions.
    pub async fn get_all(pool: &PgPool) -> Result<Vec<AssetRestriction>, sqlx::Error> {
        sqlx::query_as::<_, AssetRestriction>(
            r#"SELECT id, ticker, restriction_type, reason, created_at
               FROM asset_restrictions
               ORDER BY restriction_type, ticker"#,
        )
        .fetch_all(pool)
        .await
    }

    /// Get restrictions by type.
    pub async fn get_by_type(
        pool: &PgPool,
        restriction_type: &str,
    ) -> Result<Vec<AssetRestriction>, sqlx::Error> {
        sqlx::query_as::<_, AssetRestriction>(
            r#"SELECT id, ticker, restriction_type, reason, created_at
               FROM asset_restrictions
               WHERE restriction_type = $1
               ORDER BY ticker"#,
        )
        .bind(restriction_type)
        .fetch_all(pool)
        .await
    }

    /// Get all restrictions for a ticker.
    pub async fn get_by_ticker(
        pool: &PgPool,
        ticker: &str,
    ) -> Result<Vec<AssetRestriction>, sqlx::Error> {
        sqlx::query_as::<_, AssetRestriction>(
            r#"SELECT id, ticker, restriction_type, reason, created_at
               FROM asset_restrictions
               WHERE ticker = $1
               ORDER BY restriction_type"#,
        )
        .bind(ticker)
        .fetch_all(pool)
        .await
    }

    /// Check if a ticker has a specific restriction.
    pub async fn has_restriction(
        pool: &PgPool,
        ticker: &str,
        restriction_type: &str,
    ) -> Result<bool, sqlx::Error> {
        let result: (bool,) = sqlx::query_as(
            r#"SELECT EXISTS(
                SELECT 1 FROM asset_restrictions 
                WHERE ticker = $1 AND restriction_type = $2
            )"#,
        )
        .bind(ticker)
        .bind(restriction_type)
        .fetch_one(pool)
        .await?;
        Ok(result.0)
    }

    /// Get all tickers with a specific restriction type.
    pub async fn get_tickers_by_type(
        pool: &PgPool,
        restriction_type: &str,
    ) -> Result<Vec<String>, sqlx::Error> {
        let rows = sqlx::query(
            r#"SELECT ticker FROM asset_restrictions WHERE restriction_type = $1 ORDER BY ticker"#,
        )
        .bind(restriction_type)
        .fetch_all(pool)
        .await?;
        Ok(rows.into_iter().map(|r| r.get::<String, _>(0)).collect())
    }

    /// Add a restriction.
    pub async fn create(
        pool: &PgPool,
        input: &AssetRestrictionInput,
    ) -> Result<AssetRestriction, sqlx::Error> {
        sqlx::query_as::<_, AssetRestriction>(
            r#"INSERT INTO asset_restrictions (ticker, restriction_type, reason)
               VALUES ($1, $2, $3)
               ON CONFLICT (ticker, restriction_type) DO UPDATE SET
               reason = EXCLUDED.reason
               RETURNING id, ticker, restriction_type, reason, created_at"#,
        )
        .bind(&input.ticker)
        .bind(&input.restriction_type)
        .bind(&input.reason)
        .fetch_one(pool)
        .await
    }

    /// Delete a restriction by ID.
    pub async fn delete(pool: &PgPool, id: i32) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM asset_restrictions WHERE id = $1")
            .bind(id)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Delete a restriction by ticker and type.
    pub async fn delete_by_ticker_and_type(
        pool: &PgPool,
        ticker: &str,
        restriction_type: &str,
    ) -> Result<bool, sqlx::Error> {
        let result = sqlx::query(
            "DELETE FROM asset_restrictions WHERE ticker = $1 AND restriction_type = $2",
        )
        .bind(ticker)
        .bind(restriction_type)
        .execute(pool)
        .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Helper: Check if ticker is in swap blacklist.
    pub async fn is_swap_blacklisted(pool: &PgPool, ticker: &str) -> Result<bool, sqlx::Error> {
        Self::has_restriction(pool, ticker, restriction_types::SWAP_BLACKLIST).await
    }

    /// Helper: Check if ticker is ignored.
    pub async fn is_ignored(pool: &PgPool, ticker: &str) -> Result<bool, sqlx::Error> {
        Self::has_restriction(pool, ticker, restriction_types::IGNORED).await
    }

    /// Helper: Check if ticker is disabled for long positions.
    pub async fn is_disabled_long(pool: &PgPool, ticker: &str) -> Result<bool, sqlx::Error> {
        Self::has_restriction(pool, ticker, restriction_types::DISABLED_LONG).await
    }

    /// Helper: Check if ticker is disabled for short positions.
    pub async fn is_disabled_short(pool: &PgPool, ticker: &str) -> Result<bool, sqlx::Error> {
        Self::has_restriction(pool, ticker, restriction_types::DISABLED_SHORT).await
    }

    /// Helper: Get all swap blacklisted tickers.
    pub async fn get_swap_blacklist(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
        Self::get_tickers_by_type(pool, restriction_types::SWAP_BLACKLIST).await
    }

    /// Helper: Get all ignored tickers.
    pub async fn get_ignored(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
        Self::get_tickers_by_type(pool, restriction_types::IGNORED).await
    }

    /// Helper: Get all tickers disabled for long positions.
    pub async fn get_disabled_long(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
        Self::get_tickers_by_type(pool, restriction_types::DISABLED_LONG).await
    }

    /// Helper: Get all tickers disabled for short positions.
    pub async fn get_disabled_short(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
        Self::get_tickers_by_type(pool, restriction_types::DISABLED_SHORT).await
    }
}
