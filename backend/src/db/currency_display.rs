//! Repository for currency display enrichment data.

use sqlx::{FromRow, PgPool, Row};

use super::models::{CurrencyDisplay, CurrencyDisplayInput};

/// Repository for currency display operations.
pub struct CurrencyDisplayRepo;

impl CurrencyDisplayRepo {
    /// Get all currency display records.
    pub async fn get_all(pool: &PgPool) -> Result<Vec<CurrencyDisplay>, sqlx::Error> {
        sqlx::query_as::<_, CurrencyDisplay>(
            r#"SELECT ticker, icon_url, color, display_name, coingecko_id, created_at, updated_at
               FROM currency_display
               ORDER BY ticker"#,
        )
        .fetch_all(pool)
        .await
    }

    /// Get a currency display by ticker.
    pub async fn get_by_ticker(
        pool: &PgPool,
        ticker: &str,
    ) -> Result<Option<CurrencyDisplay>, sqlx::Error> {
        sqlx::query_as::<_, CurrencyDisplay>(
            r#"SELECT ticker, icon_url, color, display_name, coingecko_id, created_at, updated_at
               FROM currency_display
               WHERE ticker = $1"#,
        )
        .bind(ticker)
        .fetch_optional(pool)
        .await
    }

    /// Check if a currency is configured (has display data).
    pub async fn is_configured(pool: &PgPool, ticker: &str) -> Result<bool, sqlx::Error> {
        let result: (bool,) = sqlx::query_as(
            r#"SELECT EXISTS(SELECT 1 FROM currency_display WHERE ticker = $1)"#,
        )
        .bind(ticker)
        .fetch_one(pool)
        .await?;
        Ok(result.0)
    }

    /// Get multiple currencies by tickers.
    pub async fn get_by_tickers(
        pool: &PgPool,
        tickers: &[String],
    ) -> Result<Vec<CurrencyDisplay>, sqlx::Error> {
        sqlx::query_as::<_, CurrencyDisplay>(
            r#"SELECT ticker, icon_url, color, display_name, coingecko_id, created_at, updated_at
               FROM currency_display
               WHERE ticker = ANY($1)
               ORDER BY ticker"#,
        )
        .bind(tickers)
        .fetch_all(pool)
        .await
    }

    /// Insert or update a currency display record.
    pub async fn upsert(pool: &PgPool, input: &CurrencyDisplayInput) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"INSERT INTO currency_display (ticker, icon_url, color, display_name, coingecko_id)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (ticker) DO UPDATE SET
               icon_url = EXCLUDED.icon_url,
               color = EXCLUDED.color,
               display_name = EXCLUDED.display_name,
               coingecko_id = EXCLUDED.coingecko_id,
               updated_at = NOW()"#,
        )
        .bind(&input.ticker)
        .bind(&input.icon_url)
        .bind(&input.color)
        .bind(&input.display_name)
        .bind(&input.coingecko_id)
        .execute(pool)
        .await?;
        Ok(())
    }

    /// Delete a currency display record.
    pub async fn delete(pool: &PgPool, ticker: &str) -> Result<bool, sqlx::Error> {
        let result = sqlx::query("DELETE FROM currency_display WHERE ticker = $1")
            .bind(ticker)
            .execute(pool)
            .await?;
        Ok(result.rows_affected() > 0)
    }

    /// Get count of configured currencies.
    pub async fn count(pool: &PgPool) -> Result<i64, sqlx::Error> {
        let row = sqlx::query(r#"SELECT COUNT(*) FROM currency_display"#)
            .fetch_one(pool)
            .await?;
        Ok(row.get::<i64, _>(0))
    }
}
