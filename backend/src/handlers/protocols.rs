//! Protocol handlers using ETL as primary data source
//!
//! Provides protocol registry including both active and deprecated protocols.

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::debug;

use crate::cache_keys;
use crate::error::AppError;
use crate::external::etl::{EtlProtocol, EtlProtocolContracts};
use crate::AppState;

/// Protocol contracts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolContracts {
    pub leaser: Option<String>,
    pub lpp: Option<String>,
    pub oracle: Option<String>,
    pub profit: Option<String>,
    pub reserve: Option<String>,
}

impl From<EtlProtocolContracts> for ProtocolContracts {
    fn from(etl: EtlProtocolContracts) -> Self {
        Self {
            leaser: etl.leaser,
            lpp: etl.lpp,
            oracle: etl.oracle,
            profit: etl.profit,
            reserve: etl.reserve,
        }
    }
}

/// Protocol information from ETL
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Protocol {
    pub name: String,
    pub network: Option<String>,
    pub dex: Option<String>,
    pub position_type: String,
    pub lpn: String,
    pub is_active: bool,
    pub contracts: ProtocolContracts,
}

impl From<EtlProtocol> for Protocol {
    fn from(etl: EtlProtocol) -> Self {
        // Clean up dex field - ETL returns it with quotes like "\"Osmosis\""
        let dex = etl.dex.map(|d| d.trim_matches('"').to_string());
        
        Self {
            name: etl.name,
            network: etl.network,
            dex,
            position_type: etl.position_type.to_lowercase(),
            lpn: etl.lpn_symbol,
            is_active: etl.is_active,
            contracts: etl.contracts.into(),
        }
    }
}

/// Response for /api/protocols endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolsResponse {
    pub protocols: HashMap<String, Protocol>,
    pub count: u32,
    pub active_count: u32,
    pub deprecated_count: u32,
}

/// GET /api/protocols
/// Returns all protocols (active and deprecated) from ETL
pub async fn get_protocols(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ProtocolsResponse>, AppError> {
    let result = state
        .cache
        .config
        .get_or_fetch(cache_keys::config::PROTOCOLS, || {
            let state = state.clone();
            async move { fetch_protocols_internal(state).await }
        })
        .await
        .map_err(AppError::Internal)?;

    let response: ProtocolsResponse = serde_json::from_value(result)
        .map_err(|e| AppError::Internal(format!("Failed to deserialize protocols: {}", e)))?;

    Ok(Json(response))
}

/// Internal function to fetch protocols from ETL
async fn fetch_protocols_internal(state: Arc<AppState>) -> Result<serde_json::Value, String> {
    debug!("Fetching protocols from ETL");

    let etl_response = state
        .etl_client
        .fetch_protocols()
        .await
        .map_err(|e| format!("Failed to fetch protocols from ETL: {}", e))?;

    let mut protocols = HashMap::new();
    for etl_protocol in etl_response.protocols {
        let name = etl_protocol.name.clone();
        protocols.insert(name, Protocol::from(etl_protocol));
    }

    let response = ProtocolsResponse {
        protocols,
        count: etl_response.count,
        active_count: etl_response.active_count,
        deprecated_count: etl_response.deprecated_count,
    };

    serde_json::to_value(&response).map_err(|e| format!("Failed to serialize protocols: {}", e))
}

/// GET /api/protocols/active
/// Returns only active protocols
pub async fn get_active_protocols(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HashMap<String, Protocol>>, AppError> {
    let response = get_protocols(State(state)).await?;
    let active: HashMap<String, Protocol> = response
        .0
        .protocols
        .into_iter()
        .filter(|(_, p)| p.is_active)
        .collect();
    Ok(Json(active))
}
