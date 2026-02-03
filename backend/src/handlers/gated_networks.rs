//! Gated Networks Handler
//!
//! Provides network-scoped endpoints.
//! Networks are filtered by gated configuration.

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::debug;

use crate::cache_keys;
use crate::error::AppError;
use crate::handlers::common_types::CurrencyDisplayInfo;
use crate::propagation::PropagationMerger;
use crate::AppState;

/// Network response with config data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkResponse {
    /// Network key (e.g., "OSMOSIS")
    pub network: String,
    /// Display name
    pub name: String,
    /// Chain ID
    pub chain_id: String,
    /// Address prefix
    pub prefix: String,
    /// Primary RPC endpoint
    pub rpc: String,
    /// Primary LCD endpoint
    pub lcd: String,
    /// Fallback RPC endpoints
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fallback_rpc: Vec<String>,
    /// Fallback LCD endpoints
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fallback_lcd: Vec<String>,
    /// Gas price
    pub gas_price: String,
    /// Explorer URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explorer: Option<String>,
    /// Network icon
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    /// Primary protocol for price deduplication
    #[serde(rename = "primaryProtocol", skip_serializing_if = "Option::is_none")]
    pub primary_protocol: Option<String>,
    /// Transaction estimation time
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimation: Option<u32>,
}

/// Response for all networks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworksResponse {
    pub networks: Vec<NetworkResponse>,
    pub count: usize,
}

/// Pool info for LPP
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolResponse {
    /// Protocol name
    pub protocol: String,
    /// Network
    pub network: String,
    /// LPP contract address
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lpp_address: Option<String>,
    /// Earn APR
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apr: Option<String>,
    /// Pool utilization
    #[serde(skip_serializing_if = "Option::is_none")]
    pub utilization: Option<String>,
    /// Total supplied
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_supplied: Option<String>,
    /// Total borrowed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_borrowed: Option<String>,
    /// Borrow APR
    #[serde(skip_serializing_if = "Option::is_none")]
    pub borrow_apr: Option<String>,
    /// LPN ticker
    pub lpn: String,
    /// LPN display info
    pub lpn_display: CurrencyDisplayInfo,
}

/// Response for network pools
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkPoolsResponse {
    pub network: String,
    pub pools: Vec<PoolResponse>,
    pub count: usize,
}

/// GET /api/networks
/// Returns all configured networks
pub async fn get_networks(
    State(state): State<Arc<AppState>>,
) -> Result<Json<NetworksResponse>, AppError> {
    let result = state
        .cache
        .config
        .get_or_fetch(cache_keys::gated::NETWORKS, || {
            let state = state.clone();
            async move { fetch_networks_internal(state).await }
        })
        .await
        .map_err(AppError::Internal)?;

    let response: NetworksResponse = serde_json::from_value(result)
        .map_err(|e| AppError::Internal(format!("Failed to deserialize networks: {}", e)))?;

    Ok(Json(response))
}

/// Internal function to fetch and merge networks
async fn fetch_networks_internal(state: Arc<AppState>) -> Result<serde_json::Value, String> {
    debug!("Fetching gated networks");

    // Load gated config
    let network_config = state
        .config_store
        .load_gated_network_config()
        .await
        .map_err(|e| format!("Failed to load network config: {}", e))?;

    // Merge networks
    let merged_networks = PropagationMerger::merge_networks(&network_config);

    let networks: Vec<NetworkResponse> = merged_networks
        .into_iter()
        .map(|n| NetworkResponse {
            network: n.network,
            name: n.name,
            chain_id: n.chain_id,
            prefix: n.prefix,
            rpc: n.rpc,
            lcd: n.lcd,
            fallback_rpc: n.fallback_rpc,
            fallback_lcd: n.fallback_lcd,
            gas_price: n.gas_price,
            explorer: n.explorer,
            icon: n.icon,
            primary_protocol: n.primary_protocol,
            estimation: n.estimation,
        })
        .collect();

    let response = NetworksResponse {
        count: networks.len(),
        networks,
    };

    serde_json::to_value(&response).map_err(|e| format!("Failed to serialize networks: {}", e))
}

/// GET /api/networks/:network
/// Returns a single network's configuration
pub async fn get_network(
    State(state): State<Arc<AppState>>,
    Path(network): Path<String>,
) -> Result<Json<NetworkResponse>, AppError> {
    debug!("Fetching network: {}", network);

    // Load gated config
    let network_config = state
        .config_store
        .load_gated_network_config()
        .await?;

    let settings = network_config
        .networks
        .get(&network)
        .filter(|s| s.is_configured())
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Network {}", network),
        })?;

    Ok(Json(NetworkResponse {
        network,
        name: settings.name.clone(),
        chain_id: settings.chain_id.clone(),
        prefix: settings.prefix.clone(),
        rpc: settings.rpc.clone(),
        lcd: settings.lcd.clone(),
        fallback_rpc: settings.fallback_rpc.clone(),
        fallback_lcd: settings.fallback_lcd.clone(),
        gas_price: settings.gas_price.clone(),
        explorer: settings.explorer.clone(),
        icon: settings.icon.clone(),
        primary_protocol: settings.primary_protocol.clone(),
        estimation: settings.estimation,
    }))
}

/// GET /api/networks/:network/pools
/// Returns LPP pools on a specific network
pub async fn get_network_pools(
    State(state): State<Arc<AppState>>,
    Path(network): Path<String>,
) -> Result<Json<NetworkPoolsResponse>, AppError> {
    debug!("Fetching pools for network: {}", network);

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
    let etl_pools = state.etl_client.fetch_pools().await?;

    // Build pool map
    let pool_map: std::collections::HashMap<&str, &crate::external::etl::EtlPool> = etl_pools
        .iter()
        .map(|p| (p.protocol.as_str(), p))
        .collect();

    // Build pools response
    let pools: Vec<PoolResponse> = etl_protocols
        .protocols
        .iter()
        .filter(|p| p.is_active)
        .filter(|p| p.network.as_deref() == Some(network.as_str()))
        .filter(|p| {
            // Check LPN is configured
            currency_config
                .currencies
                .get(&p.lpn_symbol)
                .map(|c| c.is_configured())
                .unwrap_or(false)
        })
        .filter_map(|p| {
            let lpn_display_config = currency_config.currencies.get(&p.lpn_symbol)?;
            let pool_data = pool_map.get(p.name.as_str());

            Some(PoolResponse {
                protocol: p.name.clone(),
                network: network.clone(),
                lpp_address: p.contracts.lpp.clone(),
                apr: pool_data.and_then(|pd| pd.apr.clone()),
                utilization: pool_data.and_then(|pd| pd.utilization.clone()),
                total_supplied: pool_data.and_then(|pd| pd.total_supplied.clone()),
                total_borrowed: pool_data.and_then(|pd| pd.total_borrowed.clone()),
                borrow_apr: pool_data.and_then(|pd| pd.borrow_apr.clone()),
                lpn: p.lpn_symbol.clone(),
                lpn_display: CurrencyDisplayInfo::from_config(
                    &p.lpn_symbol,
                    lpn_display_config,
                    &p.lpn_symbol,
                ),
            })
        })
        .collect();

    Ok(Json(NetworkPoolsResponse {
        network,
        count: pools.len(),
        pools,
    }))
}
