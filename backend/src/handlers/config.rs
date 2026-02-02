use axum::{extract::State, Json};
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error};

use crate::cache_keys;
use crate::error::AppError;
use crate::external::chain::ProtocolContractsInfo;
use crate::AppState;

/// Full application config response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfigResponse {
    pub protocols: HashMap<String, ProtocolInfo>,
    pub networks: Vec<NetworkInfo>,
    pub native_asset: NativeAssetInfo,
    pub contracts: ContractsInfo,
}

/// Protocol information including contract addresses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolInfo {
    pub name: String,
    pub network: String,
    pub dex: String,
    pub lpn: String,
    pub contracts: ProtocolContracts,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolContracts {
    pub oracle: String,
    pub lpp: String,
    pub leaser: String,
    pub profit: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reserve: Option<String>,
}

impl From<ProtocolContractsInfo> for ProtocolContracts {
    fn from(info: ProtocolContractsInfo) -> Self {
        Self {
            oracle: info.oracle,
            lpp: info.lpp,
            leaser: info.leaser,
            profit: info.profit,
            reserve: info.reserve,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub key: String,
    pub name: String,
    pub chain_id: String,
    pub prefix: String,
    pub rpc_url: String,
    pub rest_url: String,
    pub native_denom: String,
    pub gas_price: String,
    pub explorer: String,
    pub symbol: String,
    pub value: String,
    pub native: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimation: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimation_duration: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimation_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forward: Option<bool>,
    pub chain_type: String,
    pub icon: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gas_multiplier: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fees_transfer: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_currency_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_currency_symbol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_currency_decimals: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeAssetInfo {
    pub ticker: String,
    pub symbol: String,
    pub denom: String,
    pub decimal_digits: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractsInfo {
    pub admin: String,
    pub dispatcher: String,
}

/// GET /api/config
/// Returns full application configuration including protocols, networks, and contracts
/// Uses request coalescing to deduplicate concurrent requests
pub async fn get_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<AppConfigResponse>, AppError> {
    // Use get_or_fetch to coalesce concurrent requests
    let result = state
        .cache
        .config
        .get_or_fetch(cache_keys::config::APP_CONFIG, || {
            let state = state.clone();
            async move { fetch_config_internal(state).await }
        })
        .await
        .map_err(AppError::Internal)?;

    let response: AppConfigResponse = serde_json::from_value(result)
        .map_err(|e| AppError::Internal(format!("Failed to deserialize config: {}", e)))?;

    Ok(Json(response))
}

/// Internal function to fetch config from chain and config store
/// Separated from handler to enable request coalescing
async fn fetch_config_internal(state: Arc<AppState>) -> Result<serde_json::Value, String> {
    debug!("Fetching protocols from Admin contract");

    // Fetch all protocols from the Admin contract
    let protocol_names = state
        .chain_client
        .get_admin_protocols(&state.config.protocols.admin_contract)
        .await
        .map_err(|e| format!("Failed to fetch protocols: {}", e))?;

    debug!("Found {} protocols", protocol_names.len());

    // Filter to active protocols only
    let active_protocol_names: Vec<_> = protocol_names
        .iter()
        .filter(|name| state.config.protocols.active_protocols.contains(*name))
        .collect();

    // Fetch all protocol details in parallel
    let protocol_futures: Vec<_> = active_protocol_names
        .iter()
        .map(|name| {
            let chain_client = state.chain_client.clone();
            let admin_contract = state.config.protocols.admin_contract.clone();
            let name = (*name).clone();
            async move {
                let result = chain_client
                    .get_admin_protocol(&admin_contract, &name)
                    .await;
                (name, result)
            }
        })
        .collect();

    let protocol_results = join_all(protocol_futures).await;

    // Process results into protocols map
    let mut protocols = HashMap::new();
    for (name, result) in protocol_results {
        match result {
            Ok(protocol_data) => {
                // Parse protocol name to extract network and dex info
                // Format: NETWORK-DEX-LPN (e.g., "OSMOSIS-OSMOSIS-USDC_NOBLE")
                let parts: Vec<&str> = name.split('-').collect();
                let (network, dex, lpn) = if parts.len() >= 3 {
                    (
                        parts[0].to_string(),
                        parts[1].to_string(),
                        parts[2..].join("-"),
                    )
                } else {
                    (name.clone(), String::new(), String::new())
                };

                protocols.insert(
                    name.clone(),
                    ProtocolInfo {
                        name: name.clone(),
                        network,
                        dex,
                        lpn,
                        contracts: protocol_data.contracts.into(),
                        active: true,
                    },
                );
            }
            Err(e) => {
                error!("Failed to fetch protocol {}: {}", name, e);
                // Continue with other protocols
            }
        }
    }

    // Load networks configuration from config store
    let networks_config = state
        .config_store
        .load_networks()
        .await
        .map_err(|e| format!("Networks configuration not found: {}", e))?;

    // Load endpoints configuration to get RPC/REST URLs
    let endpoints_config = state.config_store.load_endpoints("pirin").await.ok();

    // Build networks info from config store
    let networks: Vec<NetworkInfo> = networks_config
        .networks
        .into_iter()
        .map(|(key, config)| {
            // Try to get RPC/REST URLs from endpoints config
            let (rpc_url, rest_url) = if let Some(ref endpoints) = endpoints_config {
                let network_key = key.to_uppercase();
                if let Some(node) = endpoints.networks.get(&network_key) {
                    (
                        node.primary.rpc.clone(),
                        node.primary.api.clone().unwrap_or_default(),
                    )
                } else {
                    (String::new(), String::new())
                }
            } else {
                (String::new(), String::new())
            };

            NetworkInfo {
                key,
                name: config.name,
                chain_id: config.chain_id,
                prefix: config.prefix,
                rpc_url,
                rest_url,
                native_denom: config.native_denom,
                gas_price: config.gas_price,
                explorer: config.explorer,
                symbol: config.symbol,
                value: config.value,
                native: config.native,
                estimation: config.estimation,
                estimation_duration: config.estimation_duration,
                estimation_type: config.estimation_type,
                forward: config.forward,
                chain_type: config.chain_type,
                icon: config.icon,
                gas_multiplier: config.gas_multiplier,
                fees_transfer: config.fees_transfer,
                native_currency_name: config.native_currency_name,
                native_currency_symbol: config.native_currency_symbol,
                native_currency_decimals: config.native_currency_decimals,
            }
        })
        .collect();

    // Build native asset info from config store
    let native_asset = NativeAssetInfo {
        ticker: networks_config.native_asset.ticker,
        symbol: networks_config.native_asset.symbol,
        denom: networks_config.native_asset.denom,
        decimal_digits: networks_config.native_asset.decimal_digits,
    };

    let response = AppConfigResponse {
        protocols,
        networks,
        native_asset,
        contracts: ContractsInfo {
            admin: state.config.protocols.admin_contract.clone(),
            dispatcher: state.config.protocols.dispatcher_contract.clone(),
        },
    };

    serde_json::to_value(&response).map_err(|e| format!("Failed to serialize config: {}", e))
}

/// GET /api/config/protocols
/// Returns only protocol information
pub async fn get_protocols(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HashMap<String, ProtocolInfo>>, AppError> {
    let config = get_config(State(state)).await?;
    Ok(Json(config.0.protocols))
}

/// GET /api/config/networks
/// Returns network configuration
pub async fn get_networks(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<NetworkInfo>>, AppError> {
    let config = get_config(State(state)).await?;
    Ok(Json(config.0.networks))
}
