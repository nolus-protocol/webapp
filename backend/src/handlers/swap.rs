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
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::debug;
use utoipa::ToSchema;

use crate::error::AppError;
use crate::external::base_client::ExternalApiClient;
use crate::external::skip::SkipChain;
use crate::AppState;

// ============================================================================
// Route Handler
// ============================================================================

/// Slim route request from frontend — backend injects all Skip config
#[derive(Debug, Deserialize, Serialize, ToSchema)]
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

/// Get Skip swap route
///
/// Enriches the slim request with gated swap config (affiliates, venues,
/// bridges) and forwards to Skip API. Response is an opaque Skip API
/// passthrough — shape is not fixed in this spec.
#[utoipa::path(
    post,
    path = "/api/swap/route",
    tag = "swap",
    request_body = RouteRequest,
    responses(
        (status = 200, description = "Opaque Skip API passthrough", content_type = "application/json", body = Object),
        (status = 503, description = "Gated config not yet populated", body = crate::error::ErrorResponse),
        (status = 502, description = "Skip API call failed", body = crate::error::ErrorResponse),
    ),
)]
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
    let response =
        state
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
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct MessagesRequest {
    pub source_asset_denom: String,
    pub source_asset_chain_id: String,
    pub dest_asset_denom: String,
    pub dest_asset_chain_id: String,
    pub amount_in: String,
    pub amount_out: String,
    /// Route operations from Skip `/route`. Opaque — passed through verbatim.
    pub operations: Vec<serde_json::Value>,
    pub address_list: Vec<String>,
}

/// Get Skip swap messages
///
/// Enriches the slim request with slippage, timeout, and affiliates from
/// gated config, then forwards to Skip API. Response is an opaque Skip API
/// passthrough — shape is not fixed in this spec.
#[utoipa::path(
    post,
    path = "/api/swap/messages",
    tag = "swap",
    request_body = MessagesRequest,
    responses(
        (status = 200, description = "Opaque Skip API passthrough", content_type = "application/json", body = Object),
        (status = 503, description = "Gated config not yet populated", body = crate::error::ErrorResponse),
        (status = 502, description = "Skip API call failed", body = crate::error::ErrorResponse),
    ),
)]
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

/// Get swap status
///
/// Forwards to Skip API `/v2/tx/status`. Response is an opaque Skip API
/// passthrough — shape is not fixed in this spec.
#[utoipa::path(
    get,
    path = "/api/swap/status/{tx_hash}",
    tag = "swap",
    params(
        ("tx_hash" = String, Path, description = "Transaction hash to query status for"),
        StatusQuery,
    ),
    responses(
        (status = 200, description = "Opaque Skip API passthrough", content_type = "application/json", body = Object),
        (status = 502, description = "Skip API call failed", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_status(
    State(state): State<Arc<AppState>>,
    Path(tx_hash): Path<String>,
    Query(query): Query<StatusQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    debug!("Getting swap status for tx: {}", tx_hash);

    let url = format!(
        "{}/v2/tx/status?tx_hash={}&chain_id={}",
        state.skip_client.base_url(),
        urlencoding::encode(&tx_hash),
        urlencoding::encode(&query.chain_id)
    );

    let response = state.skip_client.get_raw(&url).await?;
    Ok(Json(response))
}

#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct StatusQuery {
    /// Chain ID the transaction lives on (e.g. `osmosis-1`)
    pub chain_id: String,
}

/// Query parameters for the chains listing endpoint.
#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct ChainsQuery {
    /// Include EVM chains in the response.
    #[serde(default = "default_true")]
    pub include_evm: bool,
    /// Include SVM chains in the response.
    #[serde(default = "default_true")]
    pub include_svm: bool,
}

fn default_true() -> bool {
    true
}

/// List supported swap chains
///
/// Proxies Skip `/v2/info/chains`. Response is an opaque Skip API
/// passthrough — shape is not fixed in this spec.
#[utoipa::path(
    get,
    path = "/api/swap/chains",
    tag = "swap",
    params(ChainsQuery),
    responses(
        (status = 200, description = "Opaque Skip API passthrough (list of chains)", content_type = "application/json", body = Vec<Object>),
        (status = 502, description = "Skip API call failed", body = crate::error::ErrorResponse),
    ),
)]
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

/// Request to track a swap transaction on Skip.
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct TrackRequest {
    /// Chain ID the transaction was submitted to
    pub chain_id: String,
    /// Transaction hash to track
    pub tx_hash: String,
}

/// Response from Skip tracking registration.
#[derive(Debug, Serialize, ToSchema)]
pub struct TrackResponse {
    pub tx_hash: String,
    pub explorer_link: Option<String>,
}

/// Track a swap transaction
///
/// Registers a transaction with Skip for cross-chain status tracking.
#[utoipa::path(
    post,
    path = "/api/swap/track",
    tag = "swap",
    request_body = TrackRequest,
    responses(
        (status = 200, description = "Tracking registered", body = TrackResponse),
        (status = 502, description = "Skip API call failed", body = crate::error::ErrorResponse),
    ),
)]
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

/// Get swap UI config
///
/// Returns UI-only swap configuration (blacklist, defaults, transfers) from
/// background-refreshed cache. Response is an opaque JSON object — shape is
/// not fixed in this spec.
#[utoipa::path(
    get,
    path = "/api/swap/config",
    tag = "swap",
    responses(
        (status = 200, description = "Opaque swap UI config", content_type = "application/json", body = Object),
        (status = 503, description = "Swap config not yet populated", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_swap_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = state
        .data_cache
        .swap_config
        .load_or_unavailable("Swap config")?;

    Ok(Json(result))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{collect_body_str, test_app_state};
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        routing::{get, post},
        Router,
    };
    use tower::ServiceExt;

    fn build_app(state: Arc<AppState>) -> Router {
        Router::new()
            .route("/api/swap/route", post(get_route))
            .route("/api/swap/messages", post(get_messages))
            .route("/api/swap/status/{tx_hash}", get(get_status))
            .route("/api/swap/config", get(get_swap_config))
            .with_state(state)
    }

    #[tokio::test]
    async fn swap_route_cold_gated_returns_503() {
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/swap/route")
                    .header("content-type", "application/json")
                    .body(Body::from(
                        serde_json::json!({
                            "source_asset_denom": "a",
                            "source_asset_chain_id": "x",
                            "dest_asset_denom": "b",
                            "dest_asset_chain_id": "y"
                        })
                        .to_string(),
                    ))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn swap_messages_malformed_json_returns_400() {
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/swap/messages")
                    .header("content-type", "application/json")
                    .body(Body::from("not-valid-json".to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn swap_status_upstream_failure_returns_502() {
        // stub Skip base (127.0.0.1:1 + 1ms timeout) fails fast → 502
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/swap/status/ABCDEF?chain_id=osmosis-1")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
    }

    #[tokio::test]
    async fn swap_config_cold_cache_returns_503() {
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/swap/config")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = collect_body_str(resp).await;
        assert!(body.contains("Swap config"), "body: {body}");
    }
}
