//! Application Configuration Handler
//!
//! Provides protocol and network configuration from ETL and gated config.

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use crate::error::AppError;
use crate::external::etl::EtlProtocol;
use crate::handlers::common_types::ProtocolContracts;
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
            contracts: ProtocolContracts::from(&etl.contracts),
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
    pub gas_price: String,
    /// Chain type (e.g., "cosmos", "evm")
    pub chain_type: String,
    /// Whether this is the native (Nolus) network
    pub native: bool,
    /// Lowercase identifier (e.g., "osmosis", "neutron")
    pub value: String,
    /// Network ticker symbol (e.g., "OSMO", "NTRN")
    pub symbol: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explorer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimation: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_protocol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forward: Option<bool>,
    /// Gas multiplier for fee estimation
    pub gas_multiplier: f64,
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
/// Reads from background-refreshed cache (zero latency).
pub async fn get_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<AppConfigResponse>, AppError> {
    let response = state
        .data_cache
        .app_config
        .load_or_unavailable("App config")?;

    Ok(Json(response))
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
