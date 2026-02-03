//! Protocol handlers using ETL as primary data source
//!
//! Provides protocol registry including both active and deprecated protocols.
//! Applies gated propagation - only configured protocols are returned by default.

use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::debug;

use crate::cache_keys;
use crate::db::models::protocol_statuses;
use crate::db::ProtocolStatusRepo;
use crate::error::AppError;
use crate::external::etl::{EtlProtocol, EtlProtocolContracts};
use crate::AppState;

/// Query parameters for protocols endpoint
#[derive(Debug, Clone, Deserialize, Default)]
pub struct ProtocolsQuery {
    /// Include all protocols (including unconfigured/blacklisted) - for admin use
    #[serde(default)]
    pub include_all: bool,
}

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

/// Protocol information from ETL enriched with DB status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Protocol {
    pub name: String,
    pub network: Option<String>,
    pub dex: Option<String>,
    pub position_type: String,
    pub lpn: String,
    pub is_active: bool,
    pub contracts: ProtocolContracts,
    /// Protocol configuration status: configured, blacklisted, or unconfigured
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    /// Whether the protocol is configured (for admin views)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_configured: Option<bool>,
}

impl Protocol {
    /// Create from ETL data with default unconfigured status
    fn from_etl(etl: EtlProtocol) -> Self {
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
            status: None,
            is_configured: None,
        }
    }

    /// Enrich with status information (for admin views)
    fn with_status(mut self, status: String) -> Self {
        let is_configured = status == protocol_statuses::CONFIGURED;
        self.status = Some(status);
        self.is_configured = Some(is_configured);
        self
    }
}

/// Response for /api/protocols endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolsResponse {
    pub protocols: HashMap<String, Protocol>,
    pub count: u32,
    pub active_count: u32,
    pub deprecated_count: u32,
    /// Number of configured protocols (only present when include_all=true)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub configured_count: Option<u32>,
    /// Number of unconfigured protocols (only present when include_all=true)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub unconfigured_count: Option<u32>,
}

/// GET /api/protocols
/// Returns protocols from ETL with gated propagation.
/// By default, only configured protocols are returned.
/// Use ?include_all=true to see all protocols with their status (for admin use).
pub async fn get_protocols(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ProtocolsQuery>,
) -> Result<Json<ProtocolsResponse>, AppError> {
    // Fetch base protocols from ETL (cached)
    let result = state
        .cache
        .config
        .get_or_fetch(cache_keys::config::PROTOCOLS, || {
            let state = state.clone();
            async move { fetch_protocols_from_etl(state).await }
        })
        .await
        .map_err(AppError::Internal)?;

    let etl_protocols: HashMap<String, Protocol> = serde_json::from_value(result)
        .map_err(|e| AppError::Internal(format!("Failed to deserialize protocols: {}", e)))?;

    // Fetch all protocol statuses from DB
    let statuses = ProtocolStatusRepo::get_all(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch protocol statuses: {}", e)))?;

    let status_map: HashMap<String, String> = statuses
        .into_iter()
        .map(|s| (s.protocol, s.status))
        .collect();

    // Enrich and filter protocols
    let mut protocols = HashMap::new();
    let mut configured_count = 0u32;
    let mut unconfigured_count = 0u32;

    for (name, protocol) in etl_protocols {
        let status = status_map
            .get(&name)
            .cloned()
            .unwrap_or_else(|| protocol_statuses::UNCONFIGURED.to_string());

        let is_configured = status == protocol_statuses::CONFIGURED;

        if is_configured {
            configured_count += 1;
        } else {
            unconfigured_count += 1;
        }

        // Skip non-configured unless include_all is set
        if !query.include_all && !is_configured {
            continue;
        }

        // Add status info only for admin view
        let enriched = if query.include_all {
            protocol.with_status(status)
        } else {
            protocol
        };

        protocols.insert(name, enriched);
    }

    let count = protocols.len() as u32;
    let active_count = protocols.values().filter(|p| p.is_active).count() as u32;
    let deprecated_count = count - active_count;

    let response = ProtocolsResponse {
        protocols,
        count,
        active_count,
        deprecated_count,
        configured_count: if query.include_all {
            Some(configured_count)
        } else {
            None
        },
        unconfigured_count: if query.include_all {
            Some(unconfigured_count)
        } else {
            None
        },
    };

    Ok(Json(response))
}

/// Internal function to fetch protocols from ETL (cached)
async fn fetch_protocols_from_etl(state: Arc<AppState>) -> Result<serde_json::Value, String> {
    debug!("Fetching protocols from ETL");

    let etl_response = state
        .etl_client
        .fetch_protocols()
        .await
        .map_err(|e| format!("Failed to fetch protocols from ETL: {}", e))?;

    let mut protocols = HashMap::new();
    for etl_protocol in etl_response.protocols {
        let name = etl_protocol.name.clone();
        protocols.insert(name, Protocol::from_etl(etl_protocol));
    }

    serde_json::to_value(&protocols).map_err(|e| format!("Failed to serialize protocols: {}", e))
}

/// GET /api/protocols/active
/// Returns only active and configured protocols
pub async fn get_active_protocols(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HashMap<String, Protocol>>, AppError> {
    // Use default query (no include_all) to only get configured protocols
    let response = get_protocols(State(state), Query(ProtocolsQuery::default())).await?;
    let active: HashMap<String, Protocol> = response
        .0
        .protocols
        .into_iter()
        .filter(|(_, p)| p.is_active)
        .collect();
    Ok(Json(active))
}
