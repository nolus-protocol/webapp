//! Validation logic for checking if entities are configured and ready.

use sqlx::PgPool;

use crate::db::{CurrencyDisplayRepo, NetworkConfigRepo, ProtocolStatusRepo};

/// Validator for checking propagation readiness.
pub struct PropagationValidator;

impl PropagationValidator {
    /// Check if a currency is configured (has display data in DB).
    pub async fn is_currency_configured(pool: &PgPool, ticker: &str) -> Result<bool, sqlx::Error> {
        CurrencyDisplayRepo::is_configured(pool, ticker).await
    }

    /// Check if a network is configured (has config in DB).
    pub async fn is_network_configured(
        pool: &PgPool,
        network_key: &str,
    ) -> Result<bool, sqlx::Error> {
        NetworkConfigRepo::is_configured(pool, network_key).await
    }

    /// Check if a protocol is explicitly configured.
    pub async fn is_protocol_configured(
        pool: &PgPool,
        protocol: &str,
    ) -> Result<bool, sqlx::Error> {
        ProtocolStatusRepo::is_configured(pool, protocol).await
    }

    /// Check if a protocol is blacklisted.
    pub async fn is_protocol_blacklisted(
        pool: &PgPool,
        protocol: &str,
    ) -> Result<bool, sqlx::Error> {
        ProtocolStatusRepo::is_blacklisted(pool, protocol).await
    }

    /// Get the status of a protocol ('configured', 'blacklisted', 'unconfigured').
    pub async fn get_protocol_status(
        pool: &PgPool,
        protocol: &str,
    ) -> Result<String, sqlx::Error> {
        ProtocolStatusRepo::get_status(pool, protocol).await
    }

    /// Extract network key from protocol name.
    /// Protocol format: "NETWORK-DEX-LPN" (e.g., "OSMOSIS-OSMOSIS-USDC_NOBLE")
    pub fn extract_network_from_protocol(protocol: &str) -> Option<String> {
        protocol.split('-').next().map(String::from)
    }

    /// Check if a protocol is ready for frontend use.
    /// A protocol is ready if:
    /// 1. It's explicitly configured (status = 'configured')
    /// 2. Its network is configured
    /// 3. It's not blacklisted
    pub async fn is_protocol_ready(pool: &PgPool, protocol: &str) -> Result<bool, sqlx::Error> {
        // Check if blacklisted first (fast path)
        if Self::is_protocol_blacklisted(pool, protocol).await? {
            return Ok(false);
        }

        // Check if explicitly configured
        if !Self::is_protocol_configured(pool, protocol).await? {
            return Ok(false);
        }

        // Check if network is configured
        if let Some(network_key) = Self::extract_network_from_protocol(protocol) {
            if !Self::is_network_configured(pool, &network_key).await? {
                return Ok(false);
            }
        }

        Ok(true)
    }

    /// Check which currencies from a list are configured.
    /// Returns a set of configured ticker names.
    pub async fn get_configured_currencies(
        pool: &PgPool,
        tickers: &[String],
    ) -> Result<std::collections::HashSet<String>, sqlx::Error> {
        let configured = CurrencyDisplayRepo::get_by_tickers(pool, tickers).await?;
        Ok(configured.into_iter().map(|c| c.ticker).collect())
    }
}
