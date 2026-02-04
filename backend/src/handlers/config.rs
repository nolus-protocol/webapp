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
        .map(|(key, settings)| {
            // Derive symbol from gas_price denom (e.g., "0.025uosmo" -> "OSMO")
            let symbol = settings
                .gas_price
                .trim_start_matches(|c: char| c.is_ascii_digit() || c == '.')
                .trim_start_matches('u')
                .to_uppercase();

            NetworkInfo {
                key: key.clone(),
                name: settings.name.clone(),
                chain_id: settings.chain_id.clone(),
                prefix: settings.prefix.clone(),
                rpc_url: settings.rpc.clone(),
                rest_url: settings.lcd.clone(),
                gas_price: settings.gas_price.clone(),
                chain_type: "cosmos".to_string(),
                native: key == "NOLUS",
                value: key.to_lowercase(),
                symbol,
                explorer: settings.explorer.clone(),
                icon: settings.icon.clone(),
                estimation: settings.estimation,
                primary_protocol: settings.primary_protocol.clone(),
                forward: settings.forward,
            }
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

/// GET /api/webapp/config/swap/skip-route
/// Returns Skip route configuration with dynamically generated transfers from ETL data.
/// The `transfers` section maps currencies between Nolus and external chains per network.
/// Uses request coalescing to deduplicate concurrent requests.
pub async fn get_skip_route_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = state
        .cache
        .config
        .get_or_fetch(cache_keys::config::SKIP_ROUTE_CONFIG, || {
            let state = state.clone();
            async move { fetch_skip_route_config_internal(state).await }
        })
        .await
        .map_err(AppError::Internal)?;

    Ok(Json(result))
}

/// Internal function to build skip route config from swap settings + ETL data
async fn fetch_skip_route_config_internal(
    state: Arc<AppState>,
) -> Result<serde_json::Value, String> {
    debug!("Building skip route config from ETL data");

    // Fetch swap settings, network config, ETL protocols, and ETL currencies in parallel
    let (swap_settings_result, network_config_result, protocols_result, currencies_result) = tokio::join!(
        state.config_store.load_swap_settings(),
        state.config_store.load_gated_network_config(),
        state.etl_client.fetch_protocols(),
        state.etl_client.fetch_currencies(),
    );

    let swap_settings = swap_settings_result
        .map_err(|e| format!("Failed to load swap settings: {}", e))?;
    let network_config = network_config_result
        .map_err(|e| format!("Failed to load network config: {}", e))?;
    let protocols_response = protocols_result
        .map_err(|e| format!("Failed to fetch protocols from ETL: {}", e))?;
    let currencies_response = currencies_result
        .map_err(|e| format!("Failed to fetch currencies from ETL: {}", e))?;

    // Build protocol -> network lookup from ETL protocols
    let mut protocol_to_network: HashMap<String, String> = HashMap::new();
    for protocol in &protocols_response.protocols {
        if let Some(ref network) = protocol.network {
            protocol_to_network.insert(protocol.name.clone(), network.to_uppercase());
        }
    }

    // Build ticker+network -> bank_symbol lookup from ETL currencies
    // Key: (ticker, network) -> bank_symbol (the IBC denom on Nolus)
    let mut ticker_network_to_denom: HashMap<(String, String), String> = HashMap::new();
    // Also build ticker -> bank_symbol for network-agnostic lookups (e.g., NLS -> unls)
    let mut ticker_to_denom: HashMap<String, String> = HashMap::new();

    for currency in &currencies_response.currencies {
        if !currency.is_active {
            continue;
        }
        for protocol_mapping in &currency.protocols {
            if let Some(network) = protocol_to_network.get(&protocol_mapping.protocol) {
                ticker_network_to_denom
                    .entry((currency.ticker.clone(), network.clone()))
                    .or_insert_with(|| protocol_mapping.bank_symbol.clone());
            }
            ticker_to_denom
                .entry(currency.ticker.clone())
                .or_insert_with(|| protocol_mapping.bank_symbol.clone());
        }
    }

    // Build transfers dynamically from ETL currencies
    // Group by network, deduplicate by bank_symbol within each network
    let mut transfers: HashMap<String, Vec<serde_json::Value>> = HashMap::new();
    let mut seen: HashMap<String, std::collections::HashSet<String>> = HashMap::new();

    for currency in &currencies_response.currencies {
        if !currency.is_active {
            continue;
        }

        for protocol_mapping in &currency.protocols {
            let network = match protocol_to_network.get(&protocol_mapping.protocol) {
                Some(n) => n,
                None => continue,
            };

            if network == "NOLUS" {
                continue;
            }

            let network_seen = seen.entry(network.clone()).or_default();
            if !network_seen.insert(protocol_mapping.bank_symbol.clone()) {
                continue;
            }

            let entry = serde_json::json!({
                "from": protocol_mapping.bank_symbol,
                "to": protocol_mapping.dex_symbol,
                "native": false,
            });

            transfers.entry(network.clone()).or_default().push(entry);
        }
    }

    // Build transfers as { network: { currencies: [...] } }
    let mut transfers_map = serde_json::Map::new();
    for (network, currencies) in transfers {
        transfers_map.insert(
            network,
            serde_json::json!({ "currencies": currencies }),
        );
    }

    // Build flat response matching SkipRouteConfigType
    let mut response = serde_json::Map::new();

    response.insert("api_url".to_string(), serde_json::json!(swap_settings.api_url));
    response.insert("blacklist".to_string(), serde_json::json!(swap_settings.blacklist));
    response.insert("slippage".to_string(), serde_json::json!(swap_settings.slippage));
    response.insert("gas_multiplier".to_string(), serde_json::json!(swap_settings.gas_multiplier));
    response.insert("fee".to_string(), serde_json::json!(swap_settings.fee));
    response.insert(
        "fee_address".to_string(),
        serde_json::json!(swap_settings.fee_address.unwrap_or_default()),
    );
    response.insert("timeoutSeconds".to_string(), serde_json::json!(swap_settings.timeout_seconds));

    // Resolve swap_to_currency ticker to denom
    let swap_to_denom = swap_settings
        .swap_to_currency
        .as_deref()
        .and_then(|ticker| ticker_to_denom.get(ticker))
        .cloned()
        .unwrap_or_default();
    response.insert("swap_to_currency".to_string(), serde_json::json!(swap_to_denom));

    // Resolve swap_currencies tickers to denoms per network
    for (network, ticker) in &swap_settings.swap_currencies {
        let network_upper = network.to_uppercase();
        let denom = ticker_network_to_denom
            .get(&(ticker.clone(), network_upper))
            .or_else(|| ticker_to_denom.get(ticker))
            .cloned()
            .unwrap_or_default();
        response.insert(format!("swap_currency_{}", network), serde_json::json!(denom));
    }

    // Build swap_venues from network config (venues are defined per-network)
    let mut venues = Vec::new();
    for (_, network_settings) in &network_config.networks {
        if let Some(ref venue) = network_settings.swap_venue {
            if let Some(ref address) = venue.address {
                response.insert(venue.name.clone(), serde_json::json!(address));
            }
            venues.push(serde_json::json!({
                "name": venue.name,
                "chain_id": network_settings.chain_id,
            }));
        }
    }
    response.insert("swap_venues".to_string(), serde_json::json!(venues));

    // Add dynamically generated transfers
    response.insert("transfers".to_string(), serde_json::Value::Object(transfers_map));

    Ok(serde_json::Value::Object(response))
}
