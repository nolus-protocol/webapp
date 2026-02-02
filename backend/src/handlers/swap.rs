//! Swap handlers for cross-chain token swaps via Skip API
//!
//! Endpoints:
//! - GET /api/swap/quote - Get a quote for swapping currencies
//! - POST /api/swap/execute - Build transaction messages to execute a swap
//! - GET /api/swap/status/:tracking_id - Get the status of a swap
//! - GET /api/swap/history - Get swap history for an address
//! - GET /api/swap/supported-pairs - Get supported swap pairs

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::debug;

use crate::error::AppError;
use crate::external::skip::{SkipChain, SkipMessagesRequest, SkipRouteRequest};
use crate::AppState;

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct SwapQuoteQuery {
    /// Source asset denom (e.g., "unls" or IBC denom)
    pub source_denom: String,
    /// Source chain ID (e.g., "pirin-1")
    pub source_chain_id: String,
    /// Destination asset denom
    pub dest_denom: String,
    /// Destination chain ID
    pub dest_chain_id: String,
    /// Amount to swap (in base units)
    pub amount: String,
    /// Slippage tolerance as percentage (e.g., "1.0" for 1%)
    pub slippage_tolerance: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SwapQuote {
    /// Amount being sent
    pub amount_in: String,
    /// Expected amount to receive
    pub amount_out: String,
    /// Source asset info
    pub source: SwapAsset,
    /// Destination asset info
    pub dest: SwapAsset,
    /// Exchange rate (amount_out / amount_in)
    pub exchange_rate: String,
    /// Price impact percentage
    pub price_impact_percent: Option<String>,
    /// Route information
    pub route: SwapRouteInfo,
    /// Estimated fees
    pub estimated_fees: Vec<SwapFee>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapAsset {
    pub denom: String,
    pub chain_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapRouteInfo {
    /// Number of hops
    pub hop_count: usize,
    /// Chain IDs involved
    pub chain_ids: Vec<String>,
    /// Whether this involves a DEX swap
    pub does_swap: bool,
    /// Operations in the route
    pub operations: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapFee {
    pub amount: String,
    pub denom: String,
    pub chain_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ExecuteSwapRequest {
    /// Source asset denom
    pub source_denom: String,
    /// Source chain ID
    pub source_chain_id: String,
    /// Destination asset denom
    pub dest_denom: String,
    /// Destination chain ID
    pub dest_chain_id: String,
    /// Amount to swap
    pub amount: String,
    /// Slippage tolerance percentage
    pub slippage_tolerance: Option<String>,
    /// Map of chain_id to address for each chain in the route
    pub addresses: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
pub struct SwapTransactionResponse {
    /// Transaction messages to sign
    pub messages: Vec<SwapMessage>,
    /// Memo for the transaction
    pub memo: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapMessage {
    pub chain_id: String,
    pub msg_type_url: String,
    pub msg: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SwapStatus {
    /// Overall status
    pub status: SwapStatusType,
    /// Transfer sequence info
    pub transfers: Vec<TransferStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferStatus {
    pub src_chain_id: String,
    pub dst_chain_id: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwapStatusType {
    Pending,
    InProgress,
    Completed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SwapHistoryEntry {
    pub tx_hash: String,
    pub source: SwapAsset,
    pub dest: SwapAsset,
    pub amount_in: String,
    pub amount_out: Option<String>,
    pub status: SwapStatusType,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SwapPair {
    pub source: SwapAsset,
    pub dest: SwapAsset,
    pub available: bool,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/swap/quote
/// Get a quote for swapping currencies via Skip API
pub async fn get_quote(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SwapQuoteQuery>,
) -> Result<Json<SwapQuote>, AppError> {
    debug!(
        "Getting swap quote: {} {} -> {} {}",
        query.amount, query.source_denom, query.dest_denom, query.dest_chain_id
    );

    let route_request = SkipRouteRequest {
        source_asset_denom: query.source_denom.clone(),
        source_asset_chain_id: query.source_chain_id.clone(),
        dest_asset_denom: query.dest_denom.clone(),
        dest_asset_chain_id: query.dest_chain_id.clone(),
        amount_in: query.amount.clone(),
        slippage_tolerance_percent: query.slippage_tolerance.clone(),
    };

    let route = state.skip_client.get_route(route_request).await?;

    // Calculate exchange rate
    let amount_in: f64 = query.amount.parse().unwrap_or(1.0);
    let amount_out: f64 = route.amount_out.parse().unwrap_or(0.0);
    let exchange_rate = if amount_in > 0.0 {
        format!("{:.8}", amount_out / amount_in)
    } else {
        "0".to_string()
    };

    // Build fees list
    let fees = route
        .estimated_fees
        .unwrap_or_default()
        .into_iter()
        .map(|f| SwapFee {
            amount: f.amount,
            denom: f.denom,
            chain_id: f.chain_id,
        })
        .collect();

    Ok(Json(SwapQuote {
        amount_in: route.amount_in,
        amount_out: route.amount_out,
        source: SwapAsset {
            denom: query.source_denom,
            chain_id: query.source_chain_id,
        },
        dest: SwapAsset {
            denom: query.dest_denom,
            chain_id: query.dest_chain_id,
        },
        exchange_rate,
        price_impact_percent: route.swap_price_impact_percent,
        route: SwapRouteInfo {
            hop_count: route.chain_ids.len().saturating_sub(1),
            chain_ids: route.chain_ids,
            does_swap: route.does_swap,
            operations: route.operations,
        },
        estimated_fees: fees,
    }))
}

/// POST /api/swap/execute
/// Build transaction messages to execute a swap via Skip API
pub async fn execute_swap(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ExecuteSwapRequest>,
) -> Result<Json<SwapTransactionResponse>, AppError> {
    debug!(
        "Building swap transaction: {} {} -> {} {}",
        request.amount, request.source_denom, request.dest_denom, request.dest_chain_id
    );

    let messages_request = SkipMessagesRequest {
        source_asset_denom: request.source_denom.clone(),
        source_asset_chain_id: request.source_chain_id.clone(),
        dest_asset_denom: request.dest_denom.clone(),
        dest_asset_chain_id: request.dest_chain_id.clone(),
        amount_in: request.amount.clone(),
        chain_ids_to_addresses: request.addresses,
        slippage_tolerance_percent: request.slippage_tolerance,
    };

    let response = state.skip_client.get_messages(messages_request).await?;

    // Convert Skip messages to our format
    let messages: Vec<SwapMessage> = response
        .msgs
        .into_iter()
        .map(|m| {
            // Parse the msg string as JSON
            let msg_value: serde_json::Value =
                serde_json::from_str(&m.msg).unwrap_or(serde_json::Value::Null);

            SwapMessage {
                chain_id: m.chain_id,
                msg_type_url: m.msg_type_url,
                msg: msg_value,
            }
        })
        .collect();

    Ok(Json(SwapTransactionResponse {
        messages,
        memo: "Swap via Nolus".to_string(),
    }))
}

/// GET /api/swap/status/:tx_hash
/// Get the status of a swap by querying Skip API
pub async fn get_status(
    State(state): State<Arc<AppState>>,
    Path(tx_hash): Path<String>,
    Query(query): Query<SwapStatusChainQuery>,
) -> Result<Json<SwapStatus>, AppError> {
    debug!("Getting swap status for tx: {}", tx_hash);

    let response = state
        .skip_client
        .get_status(&tx_hash, &query.chain_id)
        .await?;

    let status = parse_skip_status(&response.status);

    let transfers = response
        .transfer_sequence
        .unwrap_or_default()
        .into_iter()
        .map(|t| TransferStatus {
            src_chain_id: t.src_chain_id,
            dst_chain_id: t.dst_chain_id,
            state: t.state,
        })
        .collect();

    Ok(Json(SwapStatus { status, transfers }))
}

#[derive(Debug, Deserialize)]
pub struct SwapStatusChainQuery {
    pub chain_id: String,
}

/// GET /api/swap/history
/// Get swap history for an address (not implemented - would need indexer)
pub async fn get_history(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<Vec<SwapHistoryEntry>>, AppError> {
    // Swap history would require an indexer service or database
    // Skip API doesn't provide historical data
    // For now, return empty array
    Ok(Json(vec![]))
}

/// GET /api/swap/supported-pairs
/// Get list of commonly used swap pairs (hardcoded for now)
pub async fn get_supported_pairs(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<Vec<SwapPair>>, AppError> {
    // Return common swap pairs
    // In production, this could be fetched from Skip's assets API
    let pairs = vec![
        SwapPair {
            source: SwapAsset {
                denom: "unls".to_string(),
                chain_id: "pirin-1".to_string(),
            },
            dest: SwapAsset {
                denom: "uosmo".to_string(),
                chain_id: "osmosis-1".to_string(),
            },
            available: true,
        },
        SwapPair {
            source: SwapAsset {
                denom: "unls".to_string(),
                chain_id: "pirin-1".to_string(),
            },
            dest: SwapAsset {
                denom: "uatom".to_string(),
                chain_id: "cosmoshub-4".to_string(),
            },
            available: true,
        },
        SwapPair {
            source: SwapAsset {
                denom: "uosmo".to_string(),
                chain_id: "osmosis-1".to_string(),
            },
            dest: SwapAsset {
                denom: "unls".to_string(),
                chain_id: "pirin-1".to_string(),
            },
            available: true,
        },
    ];

    Ok(Json(pairs))
}

/// GET /api/swap/chains
/// Get supported chains from Skip API
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

/// POST /api/swap/route
/// Get optimal route for a swap - pass-through to Skip API
pub async fn get_route(
    State(state): State<Arc<AppState>>,
    Json(request): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    debug!("Getting swap route via Skip API");

    // Pass through to Skip API directly for maximum compatibility
    let url = format!("{}/v2/fungible/route", state.skip_client.base_url());

    let response = state.skip_client.post_raw(&url, &request).await?;

    Ok(Json(response))
}

/// POST /api/swap/messages
/// Get transaction messages for a swap route - pass-through to Skip API
pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    Json(request): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, AppError> {
    debug!("Getting swap messages via Skip API");

    // Pass through to Skip API directly for maximum compatibility
    let url = format!("{}/v2/fungible/msgs", state.skip_client.base_url());

    let response = state.skip_client.post_raw(&url, &request).await?;

    Ok(Json(response))
}

/// POST /api/swap/track
/// Track/register a transaction with Skip API
#[derive(Debug, Deserialize)]
pub struct TrackRequest {
    pub chain_id: String,
    pub tx_hash: String,
}

#[derive(Debug, Serialize)]
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

// ============================================================================
// Helper Functions
// ============================================================================

fn parse_skip_status(status: &str) -> SwapStatusType {
    match status.to_lowercase().as_str() {
        "state_completed" | "completed" | "success" => SwapStatusType::Completed,
        "state_pending" | "pending" | "received" => SwapStatusType::Pending,
        "state_in_progress" | "in_progress" | "ongoing" => SwapStatusType::InProgress,
        _ => SwapStatusType::Failed,
    }
}

