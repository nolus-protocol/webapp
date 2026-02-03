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
use tracing::debug;

use crate::cache_keys;
use crate::error::AppError;
use crate::handlers::currencies::get_prices;
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

/// Currency display info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyDisplayInfo {
    pub ticker: String,
    pub icon: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "shortName")]
    pub short_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

/// Protocol contract addresses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolContracts {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub leaser: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lpp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oracle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reserve: Option<String>,
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
pub async fn get_protocols(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ProtocolsResponse>, AppError> {
    let result = state
        .cache
        .config
        .get_or_fetch(cache_keys::gated::PROTOCOLS, || {
            let state = state.clone();
            async move { fetch_protocols_internal(state).await }
        })
        .await
        .map_err(AppError::Internal)?;

    let response: ProtocolsResponse = serde_json::from_value(result)
        .map_err(|e| AppError::Internal(format!("Failed to deserialize protocols: {}", e)))?;

    Ok(Json(response))
}

/// Internal function to fetch and merge protocols
async fn fetch_protocols_internal(state: Arc<AppState>) -> Result<serde_json::Value, String> {
    debug!("Fetching gated protocols");

    // Load gated configs
    let currency_config = state
        .config_store
        .load_currency_display()
        .await
        .map_err(|e| format!("Failed to load currency display config: {}", e))?;

    let network_config = state
        .config_store
        .load_gated_network_config()
        .await
        .map_err(|e| format!("Failed to load network config: {}", e))?;

    // Fetch ETL data
    let etl_protocols = state
        .etl_client
        .fetch_protocols()
        .await
        .map_err(|e| format!("Failed to fetch protocols from ETL: {}", e))?;

    // Filter and merge protocols
    let filtered_protocols = PropagationFilter::filter_protocols(
        &etl_protocols,
        &currency_config,
        &network_config,
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
                contracts: ProtocolContracts {
                    leaser: p.contracts.leaser.clone(),
                    lpp: p.contracts.lpp.clone(),
                    oracle: p.contracts.oracle.clone(),
                    profit: p.contracts.profit.clone(),
                    reserve: p.contracts.reserve.clone(),
                },
            })
        })
        .collect();

    let response = ProtocolsResponse {
        count: protocols.len(),
        protocols,
    };

    serde_json::to_value(&response).map_err(|e| format!("Failed to serialize protocols: {}", e))
}

/// GET /api/protocols/:protocol/currencies
/// Returns currencies for a specific protocol with protocol-specific prices
pub async fn get_protocol_currencies(
    State(state): State<Arc<AppState>>,
    Path(protocol): Path<String>,
) -> Result<Json<ProtocolCurrenciesResponse>, AppError> {
    debug!("Fetching currencies for protocol: {}", protocol);

    // Load gated configs
    let currency_config = state
        .config_store
        .load_currency_display()
        .await?;

    let network_config = state
        .config_store
        .load_gated_network_config()
        .await?;

    // Fetch ETL data
    let etl_currencies = state.etl_client.fetch_currencies().await?;
    let etl_protocols = state.etl_client.fetch_protocols().await?;

    // Fetch Oracle prices (on-chain)
    let prices_response = get_prices(State(state.clone())).await?;

    // Verify protocol exists and is configured
    let configured_protocols = PropagationFilter::filter_protocols(
        &etl_protocols,
        &currency_config,
        &network_config,
    );

    if !configured_protocols.iter().any(|p| p.name == protocol) {
        return Err(AppError::NotFound {
            resource: format!("Protocol {}", protocol),
        });
    }

    // Filter currencies for this protocol
    let filtered_currencies = PropagationFilter::filter_currencies_for_protocol(
        &etl_currencies,
        &currency_config,
        &protocol,
    );

    // Build response with Oracle prices
    let currencies: Vec<ProtocolCurrencyResponse> = filtered_currencies
        .iter()
        .filter_map(|c| {
            let display = currency_config.currencies.get(&c.ticker)?;
            if !display.is_configured() {
                return None;
            }

            // Get protocol-specific mapping
            let protocol_mapping = c.protocols.iter().find(|pm| pm.protocol == protocol)?;

            // Get protocol-specific price from Oracle
            let price_key = format!("{}@{}", c.ticker, protocol);
            let price = prices_response.0.prices.get(&price_key).map(|p| p.price_usd.clone());

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
    debug!("Fetching protocols for network: {}", network);

    // Load gated configs
    let currency_config = state
        .config_store
        .load_currency_display()
        .await?;

    let network_config = state
        .config_store
        .load_gated_network_config()
        .await?;

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
                contracts: ProtocolContracts {
                    leaser: p.contracts.leaser.clone(),
                    lpp: p.contracts.lpp.clone(),
                    oracle: p.contracts.oracle.clone(),
                    profit: p.contracts.profit.clone(),
                    reserve: p.contracts.reserve.clone(),
                },
            })
        })
        .collect();

    Ok(Json(ProtocolsResponse {
        count: protocols.len(),
        protocols,
    }))
}
