//! Filtering logic for applying blacklists and restrictions.

use std::collections::HashSet;

use sqlx::PgPool;

use crate::db::{models::restriction_types, AssetRestrictionsRepo, ProtocolStatusRepo};

use super::merger::EnrichedCurrency;

/// Filter for applying propagation rules.
pub struct PropagationFilter;

impl PropagationFilter {
    /// Filter out blacklisted currencies from swap operations.
    pub async fn filter_swap_blacklisted(
        pool: &PgPool,
        currencies: Vec<EnrichedCurrency>,
    ) -> Result<Vec<EnrichedCurrency>, sqlx::Error> {
        let blacklist = AssetRestrictionsRepo::get_swap_blacklist(pool).await?;
        let blacklisted: HashSet<_> = blacklist.into_iter().collect();

        Ok(currencies
            .into_iter()
            .filter(|c| !blacklisted.contains(&c.ticker))
            .collect())
    }

    /// Filter out ignored currencies.
    pub async fn filter_ignored(
        pool: &PgPool,
        currencies: Vec<EnrichedCurrency>,
    ) -> Result<Vec<EnrichedCurrency>, sqlx::Error> {
        let ignored = AssetRestrictionsRepo::get_ignored(pool).await?;
        let ignored_set: HashSet<_> = ignored.into_iter().collect();

        Ok(currencies
            .into_iter()
            .filter(|c| !ignored_set.contains(&c.ticker))
            .collect())
    }

    /// Filter currencies for long positions (exclude disabled_long).
    pub async fn filter_for_long_positions(
        pool: &PgPool,
        currencies: Vec<EnrichedCurrency>,
    ) -> Result<Vec<EnrichedCurrency>, sqlx::Error> {
        let disabled = AssetRestrictionsRepo::get_disabled_long(pool).await?;
        let disabled_set: HashSet<_> = disabled.into_iter().collect();

        Ok(currencies
            .into_iter()
            .filter(|c| !disabled_set.contains(&c.ticker))
            .collect())
    }

    /// Filter currencies for short positions (exclude disabled_short).
    pub async fn filter_for_short_positions(
        pool: &PgPool,
        currencies: Vec<EnrichedCurrency>,
    ) -> Result<Vec<EnrichedCurrency>, sqlx::Error> {
        let disabled = AssetRestrictionsRepo::get_disabled_short(pool).await?;
        let disabled_set: HashSet<_> = disabled.into_iter().collect();

        Ok(currencies
            .into_iter()
            .filter(|c| !disabled_set.contains(&c.ticker))
            .collect())
    }

    /// Filter out unconfigured currencies.
    pub fn filter_unconfigured(currencies: Vec<EnrichedCurrency>) -> Vec<EnrichedCurrency> {
        currencies.into_iter().filter(|c| c.is_configured).collect()
    }

    /// Filter out inactive currencies (from ETL).
    pub fn filter_inactive(currencies: Vec<EnrichedCurrency>) -> Vec<EnrichedCurrency> {
        currencies.into_iter().filter(|c| c.is_active).collect()
    }

    /// Apply all standard filters for frontend display.
    /// Filters: unconfigured, inactive, ignored.
    pub async fn apply_standard_filters(
        pool: &PgPool,
        currencies: Vec<EnrichedCurrency>,
    ) -> Result<Vec<EnrichedCurrency>, sqlx::Error> {
        let currencies = Self::filter_unconfigured(currencies);
        let currencies = Self::filter_inactive(currencies);
        Self::filter_ignored(pool, currencies).await
    }

    /// Get all blacklisted protocol names.
    pub async fn get_blacklisted_protocols(pool: &PgPool) -> Result<Vec<String>, sqlx::Error> {
        ProtocolStatusRepo::get_blacklisted_protocols(pool).await
    }

    /// Check if a specific ticker has any restriction of the given type.
    pub async fn has_restriction(
        pool: &PgPool,
        ticker: &str,
        restriction_type: &str,
    ) -> Result<bool, sqlx::Error> {
        AssetRestrictionsRepo::has_restriction(pool, ticker, restriction_type).await
    }

    /// Get all restrictions for a ticker.
    pub async fn get_ticker_restrictions(
        pool: &PgPool,
        ticker: &str,
    ) -> Result<Vec<String>, sqlx::Error> {
        let restrictions = AssetRestrictionsRepo::get_by_ticker(pool, ticker).await?;
        Ok(restrictions
            .into_iter()
            .map(|r| r.restriction_type)
            .collect())
    }

    /// Filter protocols by status - only return configured ones.
    pub async fn filter_protocols_by_status<T: HasProtocol>(
        pool: &PgPool,
        items: Vec<T>,
    ) -> Result<Vec<T>, sqlx::Error> {
        let configured = ProtocolStatusRepo::get_configured_protocols(pool).await?;
        let configured_set: HashSet<_> = configured.into_iter().collect();

        Ok(items
            .into_iter()
            .filter(|item| configured_set.contains(item.protocol()))
            .collect())
    }

    /// Filter out blacklisted protocols.
    pub async fn filter_blacklisted_protocols<T: HasProtocol>(
        pool: &PgPool,
        items: Vec<T>,
    ) -> Result<Vec<T>, sqlx::Error> {
        let blacklisted = ProtocolStatusRepo::get_blacklisted_protocols(pool).await?;
        let blacklisted_set: HashSet<_> = blacklisted.into_iter().collect();

        Ok(items
            .into_iter()
            .filter(|item| !blacklisted_set.contains(item.protocol()))
            .collect())
    }
}

/// Trait for items that have a protocol field.
pub trait HasProtocol {
    fn protocol(&self) -> &str;
}

// Implement for common types that have protocol field
impl HasProtocol for crate::external::etl::EtlPool {
    fn protocol(&self) -> &str {
        &self.protocol
    }
}
