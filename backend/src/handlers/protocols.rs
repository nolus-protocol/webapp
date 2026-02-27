//! Protocol handlers using ETL as primary data source
//!
//! Provides protocol registry including both active and deprecated protocols.

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use crate::error::AppError;
use crate::external::etl::EtlProtocol;
use crate::handlers::common_types::ProtocolContracts;
use crate::AppState;

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
/// Returns all protocols (active and deprecated)
/// Reads from background-refreshed app_config cache and converts to protocol view.
pub async fn get_protocols(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ProtocolsResponse>, AppError> {
    // Read app_config from cache and convert to ProtocolsResponse
    let app_config = state
        .data_cache
        .app_config
        .load_or_unavailable("Protocols")?;

    let mut protocols = HashMap::new();
    let mut active_count = 0u32;
    let mut deprecated_count = 0u32;

    for (name, info) in &app_config.protocols {
        if info.is_active {
            active_count += 1;
        } else {
            deprecated_count += 1;
        }
        protocols.insert(
            name.clone(),
            Protocol {
                name: info.name.clone(),
                network: info.network.clone(),
                dex: info.dex.clone(),
                position_type: info.position_type.clone(),
                lpn: info.lpn.clone(),
                is_active: info.is_active,
                contracts: info.contracts.clone(),
            },
        );
    }

    let count = active_count + deprecated_count;

    Ok(Json(ProtocolsResponse {
        protocols,
        count,
        active_count,
        deprecated_count,
    }))
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
