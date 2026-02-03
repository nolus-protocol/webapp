//! Merging logic for combining ETL data with admin enrichment.

use serde::{Deserialize, Serialize};
use sqlx::PgPool;

use crate::db::{models::CurrencyDisplay, CurrencyDisplayRepo, NetworkConfigRepo};
use crate::external::etl::{EtlCurrency, EtlCurrencyProtocol};

/// Enriched currency combining ETL data with admin display config.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichedCurrency {
    // From ETL
    pub ticker: String,
    pub decimal_digits: u8,
    pub is_active: bool,
    pub protocols: Vec<EtlCurrencyProtocol>,

    // From admin config (enrichment)
    pub icon_url: String,
    pub color: String,
    pub display_name: String,
    pub coingecko_id: Option<String>,

    // Status
    pub is_configured: bool,
}

/// Enriched network combining ETL data with admin config.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichedNetwork {
    pub network_key: String,
    pub explorer_url: String,
    pub gas_price: String,
    pub gas_multiplier: String,
    pub primary_protocol: Option<String>,
    pub is_configured: bool,
}

/// Merger for combining ETL and admin data.
pub struct DataMerger;

impl DataMerger {
    /// Merge an ETL currency with admin display config.
    /// Returns None if the currency is not configured (no display data).
    pub async fn merge_currency(
        pool: &PgPool,
        etl_currency: &EtlCurrency,
    ) -> Result<Option<EnrichedCurrency>, sqlx::Error> {
        let display = CurrencyDisplayRepo::get_by_ticker(pool, &etl_currency.ticker).await?;

        match display {
            Some(d) => Ok(Some(Self::create_enriched_currency(etl_currency, d))),
            None => Ok(None),
        }
    }

    /// Merge an ETL currency with admin display config.
    /// Fails if the currency is not configured.
    pub async fn merge_currency_required(
        pool: &PgPool,
        etl_currency: &EtlCurrency,
    ) -> Result<EnrichedCurrency, MergeError> {
        let display = CurrencyDisplayRepo::get_by_ticker(pool, &etl_currency.ticker)
            .await
            .map_err(MergeError::Database)?;

        match display {
            Some(d) => Ok(Self::create_enriched_currency(etl_currency, d)),
            None => Err(MergeError::NotConfigured(format!(
                "Currency {} not configured",
                etl_currency.ticker
            ))),
        }
    }

    /// Create an enriched currency from ETL data and display config.
    fn create_enriched_currency(
        etl: &EtlCurrency,
        display: CurrencyDisplay,
    ) -> EnrichedCurrency {
        EnrichedCurrency {
            ticker: etl.ticker.clone(),
            decimal_digits: etl.decimal_digits,
            is_active: etl.is_active,
            protocols: etl.protocols.clone(),
            icon_url: display.icon_url,
            color: display.color.unwrap_or_else(|| "#808080".to_string()),
            display_name: display.display_name,
            coingecko_id: display.coingecko_id,
            is_configured: true,
        }
    }

    /// Merge multiple ETL currencies with admin display config.
    /// Only returns configured currencies.
    pub async fn merge_currencies(
        pool: &PgPool,
        etl_currencies: &[EtlCurrency],
    ) -> Result<Vec<EnrichedCurrency>, sqlx::Error> {
        // Get all tickers
        let tickers: Vec<String> = etl_currencies.iter().map(|c| c.ticker.clone()).collect();

        // Fetch all display configs at once
        let displays = CurrencyDisplayRepo::get_by_tickers(pool, &tickers).await?;
        let display_map: std::collections::HashMap<_, _> = displays
            .into_iter()
            .map(|d| (d.ticker.clone(), d))
            .collect();

        // Merge
        let mut result = Vec::new();
        for etl in etl_currencies {
            if let Some(display) = display_map.get(&etl.ticker) {
                result.push(Self::create_enriched_currency(etl, display.clone()));
            }
        }

        Ok(result)
    }

    /// Merge multiple ETL currencies, including unconfigured ones with default values.
    /// Unconfigured currencies will have is_configured = false.
    pub async fn merge_currencies_all(
        pool: &PgPool,
        etl_currencies: &[EtlCurrency],
    ) -> Result<Vec<EnrichedCurrency>, sqlx::Error> {
        // Get all tickers
        let tickers: Vec<String> = etl_currencies.iter().map(|c| c.ticker.clone()).collect();

        // Fetch all display configs at once
        let displays = CurrencyDisplayRepo::get_by_tickers(pool, &tickers).await?;
        let display_map: std::collections::HashMap<_, _> = displays
            .into_iter()
            .map(|d| (d.ticker.clone(), d))
            .collect();

        // Merge all, using defaults for unconfigured
        let result = etl_currencies
            .iter()
            .map(|etl| {
                if let Some(display) = display_map.get(&etl.ticker) {
                    Self::create_enriched_currency(etl, display.clone())
                } else {
                    // Unconfigured - use defaults
                    EnrichedCurrency {
                        ticker: etl.ticker.clone(),
                        decimal_digits: etl.decimal_digits,
                        is_active: etl.is_active,
                        protocols: etl.protocols.clone(),
                        icon_url: String::new(),
                        color: "#808080".to_string(),
                        display_name: etl.ticker.clone(),
                        coingecko_id: None,
                        is_configured: false,
                    }
                }
            })
            .collect();

        Ok(result)
    }

    /// Get enriched network config.
    pub async fn get_enriched_network(
        pool: &PgPool,
        network_key: &str,
    ) -> Result<Option<EnrichedNetwork>, sqlx::Error> {
        let config = NetworkConfigRepo::get_by_key(pool, network_key).await?;

        Ok(config.map(|c| EnrichedNetwork {
            network_key: c.network_key,
            explorer_url: c.explorer_url,
            gas_price: c.gas_price.to_string(),
            gas_multiplier: c.gas_multiplier.to_string(),
            primary_protocol: c.primary_protocol,
            is_configured: true,
        }))
    }
}

/// Error type for merge operations.
#[derive(Debug)]
pub enum MergeError {
    /// Entity is not configured in admin config.
    NotConfigured(String),
    /// Database error.
    Database(sqlx::Error),
}

impl std::fmt::Display for MergeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MergeError::NotConfigured(msg) => write!(f, "Not configured: {}", msg),
            MergeError::Database(e) => write!(f, "Database error: {}", e),
        }
    }
}

impl std::error::Error for MergeError {}
