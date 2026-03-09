//! Swap handlers for cross-chain token swaps via Skip API
//!
//! Endpoints:
//! - POST /api/swap/route - Get optimal route (enriched with gated config)
//! - POST /api/swap/messages - Get transaction messages (enriched with gated config)
//! - GET /api/swap/status/:tx_hash - Get the status of a swap
//! - GET /api/swap/chains - Get supported chains
//! - POST /api/swap/track - Track a transaction
//! - GET /api/swap/config - Get UI swap configuration

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use tracing::debug;

use crate::error::AppError;
use crate::external::base_client::ExternalApiClient;
use crate::external::skip::SkipChain;
use crate::AppState;

// ============================================================================
// Route Handler
// ============================================================================

/// Slim route request from frontend — backend injects all Skip config
#[derive(Debug, Deserialize)]
pub struct RouteRequest {
    pub source_asset_denom: String,
    pub source_asset_chain_id: String,
    pub dest_asset_denom: String,
    pub dest_asset_chain_id: String,
    pub amount_in: Option<String>,
    pub amount_out: Option<String>,
    /// Optional network hint to filter swap venues (e.g., "osmosis")
    pub network: Option<String>,
}

/// POST /api/swap/route
/// Enriches slim request with gated config, calls Skip API
pub async fn get_route(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RouteRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    debug!(
        "Getting swap route: {} -> {}",
        request.source_asset_denom, request.dest_asset_denom
    );

    let gated = state
        .data_cache
        .gated_config
        .load_or_unavailable("Gated config")?;

    let swap = &gated.swap_settings;
    let network_config = &gated.network_config;

    // Build swap_venues from network config, filtered by network hint if provided
    let swap_venues: Vec<serde_json::Value> = network_config
        .networks
        .values()
        .filter_map(|ns| {
            let venue = ns.swap_venue.as_ref()?;
            if let Some(ref hint) = request.network {
                if !ns.chain_id.starts_with(hint) {
                    return None;
                }
            }
            Some(serde_json::json!({
                "name": venue.name,
                "chain_id": ns.chain_id,
            }))
        })
        .collect();

    let mut body = serde_json::json!({
        "source_asset_denom": request.source_asset_denom,
        "source_asset_chain_id": request.source_asset_chain_id,
        "dest_asset_denom": request.dest_asset_denom,
        "dest_asset_chain_id": request.dest_asset_chain_id,
        "cumulative_affiliate_fee_bps": swap.fee.to_string(),
        "go_fast": swap.go_fast,
        "smart_relay": swap.smart_relay,
        "allow_multi_tx": swap.allow_multi_tx,
        "allow_unsafe": swap.allow_unsafe,
        "swap_venues": swap_venues,
        "bridges": swap.bridges,
        "experimental_features": swap.experimental_features,
        "smart_swap_options": {
            "split_routes": swap.smart_swap_options.split_routes,
            "evm_swaps": swap.smart_swap_options.evm_swaps,
        },
    });

    if let Some(ref amount_in) = request.amount_in {
        body["amount_in"] = serde_json::json!(amount_in);
    }
    if let Some(ref amount_out) = request.amount_out {
        body["amount_out"] = serde_json::json!(amount_out);
    }

    let url = format!("{}/v2/fungible/route", state.skip_client.base_url());
    let response = state
        .skip_client
        .post_raw(&url, &body)
        .await
        .map_err(|e| AppError::SwapRouteFailed {
            message: e.to_string(),
        })?;
    Ok(Json(response))
}

// ============================================================================
// Messages Handler
// ============================================================================

/// Slim messages request from frontend — backend injects slippage, timeout, affiliates
#[derive(Debug, Deserialize)]
pub struct MessagesRequest {
    pub source_asset_denom: String,
    pub source_asset_chain_id: String,
    pub dest_asset_denom: String,
    pub dest_asset_chain_id: String,
    pub amount_in: String,
    pub amount_out: String,
    pub operations: Vec<serde_json::Value>,
    pub address_list: Vec<String>,
}

/// POST /api/swap/messages
/// Enriches slim request with slippage, timeout, affiliates from gated config
pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    Json(request): Json<MessagesRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    debug!(
        "Getting swap messages: {} -> {}",
        request.source_asset_denom, request.dest_asset_denom
    );

    let gated = state
        .data_cache
        .gated_config
        .load_or_unavailable("Gated config")?;

    let swap = &gated.swap_settings;
    let network_config = &gated.network_config;

    // Build affiliates by finding swap venues in operations and looking up their addresses
    let mut chain_ids_to_affiliates = serde_json::Map::new();
    for op in &request.operations {
        let venue_name = op
            .get("swap")
            .and_then(|s| s.get("swap_venue"))
            .and_then(|v| v.get("name"))
            .and_then(|n| n.as_str());

        if let Some(name) = venue_name {
            for ns in network_config.networks.values() {
                if let Some(ref venue) = ns.swap_venue {
                    if venue.name == name {
                        if let Some(ref address) = venue.address {
                            chain_ids_to_affiliates.insert(
                                ns.chain_id.clone(),
                                serde_json::json!({
                                    "affiliates": [{
                                        "address": address,
                                        "basisPointsFee": swap.fee.to_string(),
                                    }]
                                }),
                            );
                        }
                        break;
                    }
                }
            }
        }
    }

    let body = serde_json::json!({
        "source_asset_chain_id": request.source_asset_chain_id,
        "source_asset_denom": request.source_asset_denom,
        "dest_asset_chain_id": request.dest_asset_chain_id,
        "dest_asset_denom": request.dest_asset_denom,
        "amount_in": request.amount_in,
        "amount_out": request.amount_out,
        "operations": request.operations,
        "address_list": request.address_list,
        "chain_ids_to_affiliates": chain_ids_to_affiliates,
        "slippage_tolerance_percent": swap.slippage.to_string(),
        "timeout_seconds": swap.timeout_seconds,
    });

    let url = format!("{}/v2/fungible/msgs", state.skip_client.base_url());
    let response = state.skip_client.post_raw(&url, &body).await?;
    Ok(Json(response))
}

// ============================================================================
// Status, Chains, Track, Config Handlers
// ============================================================================

/// GET /api/swap/status/:tx_hash
pub async fn get_status(
    State(state): State<Arc<AppState>>,
    Path(tx_hash): Path<String>,
    Query(query): Query<StatusQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    debug!("Getting swap status for tx: {}", tx_hash);

    let url = format!(
        "{}/v2/tx/status?tx_hash={}&chain_id={}",
        state.skip_client.base_url(),
        tx_hash,
        query.chain_id
    );

    let response = state.skip_client.get_raw(&url).await?;
    Ok(Json(response))
}

#[derive(Debug, Deserialize)]
pub struct StatusQuery {
    pub chain_id: String,
}

/// GET /api/swap/chains
#[derive(Debug, Deserialize)]
pub struct ChainsQuery {
    #[serde(default = "default_true")]
    pub include_evm: bool,
    #[serde(default = "default_true")]
    pub include_svm: bool,
}

fn default_true() -> bool {
    true
}

pub async fn get_chains(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ChainsQuery>,
) -> Result<Json<Vec<SkipChain>>, AppError> {
    debug!(
        "Getting swap chains: include_evm={}, include_svm={}",
        query.include_evm, query.include_svm
    );

    let response = state
        .skip_client
        .get_chains(query.include_evm, query.include_svm)
        .await?;

    Ok(Json(response.chains))
}

/// POST /api/swap/track
#[derive(Debug, Deserialize)]
pub struct TrackRequest {
    pub chain_id: String,
    pub tx_hash: String,
}

#[derive(Debug, serde::Serialize)]
pub struct TrackResponse {
    pub tx_hash: String,
    pub explorer_link: Option<String>,
}

pub async fn track_transaction(
    State(state): State<Arc<AppState>>,
    Json(request): Json<TrackRequest>,
) -> Result<Json<TrackResponse>, AppError> {
    debug!(
        "Tracking transaction: {} on chain {}",
        request.tx_hash, request.chain_id
    );

    let response = state
        .skip_client
        .track_transaction(&request.chain_id, &request.tx_hash)
        .await?;

    Ok(Json(TrackResponse {
        tx_hash: response.tx_hash,
        explorer_link: response.explorer_link,
    }))
}

/// GET /api/swap/config
/// Returns UI-only swap configuration (blacklist, defaults, transfers).
/// Reads from background-refreshed cache (zero latency).
pub async fn get_swap_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = state
        .data_cache
        .swap_config
        .load_or_unavailable("Swap config")?;

    Ok(Json(result))
}
