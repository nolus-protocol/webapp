//! Gated Assets Handler
//!
//! Provides deduplicated asset view for display.
//! Assets are filtered by gated configuration and merged with enrichment.
//! Prices are fetched from Oracle contracts on-chain.

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::debug;

use crate::error::AppError;
use crate::handlers::currencies::PriceInfo;
use crate::propagation::PropagationFilter;
use crate::AppState;

/// Single asset with display info and price
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetResponse {
    pub ticker: String,
    pub decimals: u8,
    pub icon: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "shortName")]
    pub short_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(rename = "coingeckoId", skip_serializing_if = "Option::is_none")]
    pub coingecko_id: Option<String>,
    /// Price in USD from primary protocol's Oracle
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<String>,
    /// Networks where this asset is available
    pub networks: Vec<String>,
    /// Protocols where this asset can be traded
    pub protocols: Vec<String>,
}

/// Response for all assets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetsResponse {
    pub assets: Vec<AssetResponse>,
    pub count: usize,
}

/// Response for single asset with full details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetDetailResponse {
    pub ticker: String,
    pub decimals: u8,
    pub icon: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "shortName")]
    pub short_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(rename = "coingeckoId", skip_serializing_if = "Option::is_none")]
    pub coingecko_id: Option<String>,
    /// Price in USD (from primary protocol for display)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<String>,
    /// Networks where this asset is available
    pub networks: Vec<String>,
    /// Protocol-specific details with prices
    pub protocol_details: Vec<ProtocolAssetDetail>,
}

/// Asset details specific to a protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolAssetDetail {
    pub protocol: String,
    pub network: String,
    /// Bank symbol (denom on Nolus)
    pub bank_symbol: String,
    /// DEX symbol (denom on DEX network)
    pub dex_symbol: String,
    /// Asset group (collateral, lpn, etc.)
    pub group: String,
    /// Protocol-specific price from Oracle
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<String>,
}

/// GET /api/assets
/// Returns deduplicated assets with display prices from primary protocol's Oracle
/// Reads from background-refreshed cache (zero latency).
pub async fn get_assets(
    State(state): State<Arc<AppState>>,
) -> Result<Json<AssetsResponse>, AppError> {
    let response =
        state
            .data_cache
            .gated_assets
            .load()
            .ok_or_else(|| AppError::ServiceUnavailable {
                message: "Assets not yet available".to_string(),
            })?;

    Ok(Json(response))
}

/// Get price for an asset using the primary protocol for its network
pub fn get_price_for_asset(
    ticker: &str,
    networks: &[String],
    network_config: &crate::config_store::gated_types::GatedNetworkConfig,
    prices: &HashMap<String, PriceInfo>,
) -> Option<String> {
    // Try to find price from primary protocol of any network
    for network in networks {
        if let Some(settings) = network_config.networks.get(network) {
            if let Some(primary_protocol) = &settings.primary_protocol {
                let price_key = format!("{}@{}", ticker, primary_protocol);
                if let Some(price_info) = prices.get(&price_key) {
                    return Some(price_info.price_usd.clone());
                }
            }
        }
    }

    // Fallback: try any protocol that has this ticker
    for (key, price_info) in prices {
        if key.starts_with(&format!("{}@", ticker)) {
            return Some(price_info.price_usd.clone());
        }
    }

    None
}

/// GET /api/assets/:ticker
/// Returns single asset with full details including protocol-specific info
pub async fn get_asset(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<Json<AssetDetailResponse>, AppError> {
    debug!("Fetching asset: {}", ticker);

    // Load gated configs from cache
    let gated =
        state
            .data_cache
            .gated_config
            .load()
            .ok_or_else(|| AppError::ServiceUnavailable {
                message: "Gated config not yet available".to_string(),
            })?;
    let currency_config = gated.currency_display;
    let network_config = gated.network_config;

    // Fetch ETL data (still needed for per-ticker detail)
    let etl_currencies = state.etl_client.fetch_currencies().await?;
    let etl_protocols = state.etl_client.fetch_protocols().await?;

    // Read prices from cache
    let prices_response =
        state
            .data_cache
            .prices
            .load()
            .ok_or_else(|| AppError::ServiceUnavailable {
                message: "Prices not yet available".to_string(),
            })?;

    // Find the currency
    let etl_currency = etl_currencies
        .currencies
        .iter()
        .find(|c| c.ticker == ticker && c.is_active)
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Asset {}", ticker),
        })?;

    // Check if configured
    let display = currency_config
        .currencies
        .get(&ticker)
        .filter(|d| d.is_configured())
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Asset {} (not configured)", ticker),
        })?;

    // Get configured protocols
    let configured_protocols =
        PropagationFilter::filter_protocols(&etl_protocols, &currency_config, &network_config);

    // Build protocol details with prices
    let protocol_details: Vec<ProtocolAssetDetail> = etl_currency
        .protocols
        .iter()
        .filter(|cp| configured_protocols.iter().any(|p| p.name == cp.protocol))
        .map(|cp| {
            let protocol = configured_protocols.iter().find(|p| p.name == cp.protocol);
            let network = protocol.and_then(|p| p.network.clone()).unwrap_or_default();

            // Get protocol-specific price
            let price_key = format!("{}@{}", ticker, cp.protocol);
            let price = prices_response
                .prices
                .get(&price_key)
                .map(|p| p.price_usd.clone());

            ProtocolAssetDetail {
                protocol: cp.protocol.clone(),
                network,
                bank_symbol: cp.bank_symbol.clone(),
                dex_symbol: cp.dex_symbol.clone(),
                group: cp.group.clone(),
                price,
            }
        })
        .collect();

    if protocol_details.is_empty() {
        return Err(AppError::NotFound {
            resource: format!("Asset {} (no configured protocols)", ticker),
        });
    }

    // Get networks
    let networks: Vec<String> = protocol_details
        .iter()
        .map(|pd| pd.network.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    // Get display price from primary protocol
    let price = get_price_for_asset(&ticker, &networks, &network_config, &prices_response.prices);

    let response = AssetDetailResponse {
        ticker: etl_currency.ticker.clone(),
        decimals: etl_currency.decimal_digits,
        icon: display.icon.clone(),
        display_name: display.display_name.clone(),
        short_name: display.short_name.clone().unwrap_or_else(|| ticker.clone()),
        color: display.color.clone(),
        coingecko_id: display.coingecko_id.clone(),
        price,
        networks,
        protocol_details,
    };

    Ok(Json(response))
}

/// GET /api/networks/:network/assets
/// Returns assets available on a specific network
pub async fn get_network_assets(
    State(state): State<Arc<AppState>>,
    Path(network): Path<String>,
) -> Result<Json<AssetsResponse>, AppError> {
    // Read gated config from cache
    let gated =
        state
            .data_cache
            .gated_config
            .load()
            .ok_or_else(|| AppError::ServiceUnavailable {
                message: "Gated config not yet available".to_string(),
            })?;
    let currency_config = gated.currency_display;
    let network_config = gated.network_config;

    // Check network is configured
    let network_settings = network_config
        .networks
        .get(&network)
        .filter(|s| s.is_configured())
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Network {}", network),
        })?;

    // Fetch ETL data (needed for per-network currency filtering)
    let etl_currencies = state.etl_client.fetch_currencies().await?;
    let etl_protocols = state.etl_client.fetch_protocols().await?;

    // Read prices from cache
    let prices_response =
        state
            .data_cache
            .prices
            .load()
            .ok_or_else(|| AppError::ServiceUnavailable {
                message: "Prices not yet available".to_string(),
            })?;

    // Filter currencies for this network
    let filtered_currencies = PropagationFilter::filter_currencies_for_network(
        &etl_currencies,
        &etl_protocols,
        &currency_config,
        &network_config,
        &network,
    );

    // Get configured protocols for this network
    let network_protocols: Vec<String> = PropagationFilter::filter_protocols_for_network(
        &etl_protocols,
        &currency_config,
        &network_config,
        &network,
    )
    .iter()
    .map(|p| p.name.clone())
    .collect();

    // Get primary protocol for this network
    let primary_protocol = network_settings.primary_protocol.as_deref();

    // Build response
    let assets: Vec<AssetResponse> = filtered_currencies
        .iter()
        .filter_map(|c| {
            let display = currency_config.currencies.get(&c.ticker)?;
            if !display.is_configured() {
                return None;
            }

            // Get protocols this currency belongs to on this network
            let currency_protocols: Vec<String> = c
                .protocols
                .iter()
                .filter(|cp| network_protocols.contains(&cp.protocol))
                .map(|cp| cp.protocol.clone())
                .collect();

            // Get price from primary protocol or first available
            let price = if let Some(pp) = primary_protocol {
                let price_key = format!("{}@{}", c.ticker, pp);
                prices_response
                    .prices
                    .get(&price_key)
                    .map(|p| p.price_usd.clone())
            } else {
                // Fallback to any protocol on this network
                currency_protocols.iter().find_map(|protocol| {
                    let price_key = format!("{}@{}", c.ticker, protocol);
                    prices_response
                        .prices
                        .get(&price_key)
                        .map(|p| p.price_usd.clone())
                })
            };

            Some(AssetResponse {
                ticker: c.ticker.clone(),
                decimals: c.decimal_digits,
                icon: display.icon.clone(),
                display_name: display.display_name.clone(),
                short_name: display
                    .short_name
                    .clone()
                    .unwrap_or_else(|| c.ticker.clone()),
                color: display.color.clone(),
                coingecko_id: display.coingecko_id.clone(),
                price,
                networks: vec![network.clone()],
                protocols: currency_protocols,
            })
        })
        .collect();

    Ok(Json(AssetsResponse {
        count: assets.len(),
        assets,
    }))
}
