//! Application Configuration Handler
//!
//! Provides protocol and network configuration from ETL and gated config.

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::debug;

use crate::cache_keys;
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explorer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimation: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_protocol: Option<String>,
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

/// Internal function to fetch config from ETL and gated config
async fn fetch_config_internal(state: Arc<AppState>) -> Result<serde_json::Value, String> {
    debug!("Fetching protocols from ETL");

    // Fetch all protocols from ETL (includes active and deprecated)
    let etl_response = state
        .etl_client
        .fetch_protocols()
        .await
        .map_err(|e| format!("Failed to fetch protocols from ETL: {}", e))?;

    debug!(
        "Found {} protocols ({} active)",
        etl_response.count, etl_response.active_count
    );

    // Convert ETL protocols to ProtocolInfo map
    let mut protocols = HashMap::new();
    for etl_protocol in etl_response.protocols {
        let name = etl_protocol.name.clone();
        protocols.insert(name, ProtocolInfo::from(etl_protocol));
    }

    // Load gated network configuration
    let network_config = state
        .config_store
        .load_gated_network_config()
        .await
        .map_err(|e| format!("Network configuration not found: {}", e))?;

    // Build networks info from gated config
    let networks: Vec<NetworkInfo> = network_config
        .networks
        .iter()
        .filter(|(_, settings)| settings.is_configured())
        .map(|(key, settings)| NetworkInfo {
            key: key.clone(),
            name: settings.name.clone(),
            chain_id: settings.chain_id.clone(),
            prefix: settings.prefix.clone(),
            rpc_url: settings.rpc.clone(),
            rest_url: settings.lcd.clone(),
            gas_price: settings.gas_price.clone(),
            explorer: settings.explorer.clone(),
            icon: settings.icon.clone(),
            estimation: settings.estimation,
            primary_protocol: settings.primary_protocol.clone(),
        })
        .collect();

    // Native asset info for Nolus
    let native_asset = NativeAssetInfo {
        ticker: "NLS".to_string(),
        symbol: "NLS".to_string(),
        denom: "unls".to_string(),
        decimal_digits: 6,
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
pub async fn get_networks(State(state): State<Arc<AppState>>) -> Result<Json<Vec<NetworkInfo>>, AppError> {
    let config = get_config(State(state)).await?;
    Ok(Json(config.0.networks))
}

/// GET /api/webapp/locales/:lang
/// Returns locale translations for the specified language
/// This is a public endpoint used by the frontend and push worker
pub async fn get_locale(
    State(state): State<Arc<AppState>>,
    Path(lang): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    debug!("Fetching locale: {}", lang);

    // Validate language code (basic sanity check)
    if lang.len() > 5 || !lang.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(AppError::Validation {
            message: "Invalid language code".to_string(),
            field: Some("lang".to_string()),
            details: None,
        });
    }

    // Load locale from translation storage
    let locale = state
        .translation_storage
        .load_active(&lang)
        .await?;

    Ok(Json(locale))
}

/// Response for hidden proposals endpoint
#[derive(Debug, Serialize)]
pub struct HiddenProposalsResponse {
    pub hidden_ids: Vec<String>,
}

/// GET /api/webapp/config/governance/hidden-proposals
/// Returns list of proposal IDs that should be hidden in the UI
pub async fn get_hidden_proposals(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HiddenProposalsResponse>, AppError> {
    debug!("Fetching hidden proposals config");

    let ui_settings = state
        .config_store
        .load_ui_settings()
        .await?;

    Ok(Json(HiddenProposalsResponse {
        hidden_ids: ui_settings.hidden_proposals,
    }))
}
