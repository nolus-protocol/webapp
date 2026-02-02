use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::debug;

use crate::cache_keys;
use crate::error::AppError;
use crate::external::etl::EtlProtocol;
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
    pub network: Option<String>,
    pub dex: Option<String>,
    pub lpn: String,
    pub position_type: String,
    pub contracts: ProtocolContracts,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolContracts {
    pub oracle: Option<String>,
    pub lpp: Option<String>,
    pub leaser: Option<String>,
    pub profit: Option<String>,
    pub reserve: Option<String>,
}

impl From<EtlProtocol> for ProtocolInfo {
    fn from(etl: EtlProtocol) -> Self {
        // Clean up dex field - ETL returns it with quotes like "\"Osmosis\""
        let dex = etl.dex.map(|d| d.trim_matches('"').to_string());

        Self {
            name: etl.name,
            network: etl.network,
            dex,
            lpn: etl.lpn_symbol,
            position_type: etl.position_type.to_lowercase(),
            contracts: ProtocolContracts {
                oracle: etl.contracts.oracle,
                lpp: etl.contracts.lpp,
                leaser: etl.contracts.leaser,
                profit: etl.contracts.profit,
                reserve: etl.contracts.reserve,
            },
            is_active: etl.is_active,
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

/// Internal function to fetch config from ETL and config store
/// Separated from handler to enable request coalescing
async fn fetch_config_internal(state: Arc<AppState>) -> Result<serde_json::Value, String> {
    debug!("Fetching protocols from ETL");

    // Fetch all protocols from ETL (includes active and deprecated)
    let etl_response = state
        .etl_client
        .fetch_protocols()
        .await
        .map_err(|e| format!("Failed to fetch protocols from ETL: {}", e))?;

    debug!("Found {} protocols ({} active)", etl_response.count, etl_response.active_count);

    // Convert ETL protocols to ProtocolInfo map
    let mut protocols = HashMap::new();
    for etl_protocol in etl_response.protocols {
        let name = etl_protocol.name.clone();
        protocols.insert(name, ProtocolInfo::from(etl_protocol));
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
