//! Gated Protocols Handler
//!
//! Provides protocol-specific views for trading.
//! Protocols are filtered by gated configuration.
//! Prices are fetched from Oracle contracts on-chain.

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::AppError;
use crate::handlers::common_types::{CurrencyDisplayInfo, ProtocolContracts};
use crate::propagation::PropagationFilter;
use crate::AppState;

/// Protocol response with merged data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolResponse {
    /// Protocol name (e.g., "OSMOSIS-OSMOSIS-USDC_NOBLE")
    pub protocol: String,
    /// Network
    pub network: String,
    /// DEX
    pub dex: String,
    /// Position type (long/short)
    pub position_type: String,
    /// LPN currency ticker
    pub lpn: String,
    /// LPN display info
    pub lpn_display: CurrencyDisplayInfo,
    /// Contract addresses
    pub contracts: ProtocolContracts,
}

/// Response for all protocols
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolsResponse {
    pub protocols: Vec<ProtocolResponse>,
    pub count: usize,
}

/// Currency with protocol-specific info and price
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolCurrencyResponse {
    pub ticker: String,
    pub decimals: u8,
    pub icon: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "shortName")]
    pub short_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// Bank symbol (denom on Nolus)
    pub bank_symbol: String,
    /// DEX symbol (denom on DEX)
    pub dex_symbol: String,
    /// Currency group (collateral, lpn, etc.)
    pub group: String,
    /// Protocol-specific price
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price: Option<String>,
}

/// Response for protocol currencies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolCurrenciesResponse {
    pub protocol: String,
    pub currencies: Vec<ProtocolCurrencyResponse>,
    pub count: usize,
}

/// GET /api/protocols
/// Returns all configured protocols
/// Reads from background-refreshed cache (zero latency).
pub async fn get_protocols(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ProtocolsResponse>, AppError> {
    let response = state
        .data_cache
        .gated_protocols
        .load_or_unavailable("Protocols")?;

    Ok(Json(response))
}

/// GET /api/protocols/:protocol/currencies
/// Returns currencies for a specific protocol with protocol-specific prices
///
/// Currencies are filtered based on:
/// - Currency display configuration (must have icon and displayName)
/// - Lease rules asset restrictions (ignore_all, ignore_long, ignore_short)
pub async fn get_protocol_currencies(
    State(state): State<Arc<AppState>>,
    Path(protocol): Path<String>,
) -> Result<Json<ProtocolCurrenciesResponse>, AppError> {
    // Read gated config from cache
    let gated = state
        .data_cache
        .gated_config
        .load_or_unavailable("Gated config")?;
    let currency_config = gated.currency_display;
    let network_config = gated.network_config;
    let lease_rules = gated.lease_rules;

    // Fetch ETL data (needed for per-protocol currency detail)
    let etl_currencies = state.etl_client.fetch_currencies().await?;
    let etl_protocols = state.etl_client.fetch_protocols().await?;

    // Read prices from cache
    let prices_response = state.data_cache.prices.load_or_unavailable("Prices")?;

    // Verify protocol exists and is configured
    let configured_protocols =
        PropagationFilter::filter_protocols(&etl_protocols, &currency_config, &network_config);

    let etl_protocol = configured_protocols
        .iter()
        .find(|p| p.name == protocol)
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Protocol {}", protocol),
        })?;

    // Get position type for this protocol (long or short)
    let position_type = etl_protocol.position_type.to_lowercase();

    // Build ignore set based on position type
    let ignore_all: std::collections::HashSet<&str> = lease_rules
        .asset_restrictions
        .ignore_all
        .iter()
        .map(|s| s.as_str())
        .collect();

    let position_ignore: std::collections::HashSet<&str> = match position_type.as_str() {
        "long" => lease_rules
            .asset_restrictions
            .ignore_long
            .iter()
            .map(|s| s.as_str())
            .collect(),
        "short" => lease_rules
            .asset_restrictions
            .ignore_short
            .iter()
            .map(|s| s.as_str())
            .collect(),
        _ => std::collections::HashSet::new(),
    };

    // Filter currencies for this protocol
    let filtered_currencies = PropagationFilter::filter_currencies_for_protocol(
        &etl_currencies,
        &currency_config,
        &protocol,
    );

    // Build response with Oracle prices, filtering out ignored assets
    let currencies: Vec<ProtocolCurrencyResponse> = filtered_currencies
        .iter()
        .filter_map(|c| {
            let display = currency_config.currencies.get(&c.ticker)?;
            if !display.is_configured() {
                return None;
            }

            // Check if asset should be ignored (ignore_all)
            if ignore_all.contains(c.ticker.as_str()) {
                return None;
            }

            // Check if asset should be ignored for this position type
            // Support both "TICKER" and "TICKER@PROTOCOL" formats
            if position_ignore.contains(c.ticker.as_str()) {
                return None;
            }
            let ticker_at_protocol = format!("{}@{}", c.ticker, protocol);
            if position_ignore.iter().any(|&s| s == ticker_at_protocol) {
                return None;
            }

            // Get protocol-specific mapping
            let protocol_mapping = c.protocols.iter().find(|pm| pm.protocol == protocol)?;

            // Get protocol-specific price from Oracle
            let price_key = format!("{}@{}", c.ticker, protocol);
            let price = prices_response
                .prices
                .get(&price_key)
                .map(|p| p.price_usd.clone());

            Some(ProtocolCurrencyResponse {
                ticker: c.ticker.clone(),
                decimals: c.decimal_digits,
                icon: display.icon.clone(),
                display_name: display.display_name.clone(),
                short_name: display
                    .short_name
                    .clone()
                    .unwrap_or_else(|| c.ticker.clone()),
                color: display.color.clone(),
                bank_symbol: protocol_mapping.bank_symbol.clone(),
                dex_symbol: protocol_mapping.dex_symbol.clone(),
                group: protocol_mapping.group.clone(),
                price,
            })
        })
        .collect();

    Ok(Json(ProtocolCurrenciesResponse {
        protocol,
        count: currencies.len(),
        currencies,
    }))
}

/// GET /api/networks/:network/protocols
/// Returns protocols on a specific network
pub async fn get_network_protocols(
    State(state): State<Arc<AppState>>,
    Path(network): Path<String>,
) -> Result<Json<ProtocolsResponse>, AppError> {
    // Read gated config from cache
    let gated = state
        .data_cache
        .gated_config
        .load_or_unavailable("Gated config")?;
    let currency_config = gated.currency_display;
    let network_config = gated.network_config;

    // Check network is configured
    if !network_config
        .networks
        .get(&network)
        .map(|s| s.is_configured())
        .unwrap_or(false)
    {
        return Err(AppError::NotFound {
            resource: format!("Network {}", network),
        });
    }

    // Fetch ETL data
    let etl_protocols = state.etl_client.fetch_protocols().await?;

    // Filter protocols for this network
    let filtered_protocols = PropagationFilter::filter_protocols_for_network(
        &etl_protocols,
        &currency_config,
        &network_config,
        &network,
    );

    let protocols: Vec<ProtocolResponse> = filtered_protocols
        .iter()
        .filter_map(|p| {
            let lpn_display = currency_config.currencies.get(&p.lpn_symbol)?;
            if !lpn_display.is_configured() {
                return None;
            }

            Some(ProtocolResponse {
                protocol: p.name.clone(),
                network: p.network.clone().unwrap_or_default(),
                dex: p.dex.clone().unwrap_or_default(),
                position_type: p.position_type.clone(),
                lpn: p.lpn_symbol.clone(),
                lpn_display: CurrencyDisplayInfo {
                    ticker: p.lpn_symbol.clone(),
                    icon: lpn_display.icon.clone(),
                    display_name: lpn_display.display_name.clone(),
                    short_name: lpn_display
                        .short_name
                        .clone()
                        .unwrap_or_else(|| p.lpn_symbol.clone()),
                    color: lpn_display.color.clone(),
                },
                contracts: ProtocolContracts::from(&p.contracts),
            })
        })
        .collect();

    Ok(Json(ProtocolsResponse {
        count: protocols.len(),
        protocols,
    }))
}
