//! ETL API proxy handlers
//!
//! This module provides proxy handlers for the ETL (Extract-Transform-Load) API.
//! All handlers forward requests to the configured ETL API URL with proper
//! parameter encoding and error handling.
//!
//! The module uses macros from `etl_macros.rs` to reduce boilerplate for
//! simple proxy handlers, while keeping complex handlers (like batch endpoints)
//! as explicit implementations for clarity.

use std::sync::Arc;

use axum::{extract::{Query, State}, http::StatusCode, response::IntoResponse, Json};
use reqwest::Client;
use serde::Deserialize;
use tracing::debug;

use crate::AppState;

// Re-export macros for use in this module
use crate::cache_keys;
use crate::{etl_proxy_raw, etl_proxy_raw_with_params, etl_proxy_typed};

// Import typed response types (only for endpoints that match)
use super::etl_types::{
    BuybackTotalResponse, OpenInterestResponse, OpenPositionValueResponse,
    RealizedPnlStatsResponse, RevenueResponse, TvlResponse, TxVolumeResponse,
};

// ============================================================================
// Query Types
// ============================================================================

/// Generic query parameters for ETL proxy endpoints
#[derive(Debug, Deserialize)]
pub struct ProxyQuery {
    #[serde(flatten)]
    pub params: std::collections::HashMap<String, String>,
}

// ============================================================================
// Cached Proxy Handlers
// These endpoints return the same data for all users and benefit from caching
// ============================================================================

// Raw passthrough handlers (ETL API returns arrays, not wrapped objects)
etl_proxy_raw!(
    proxy_pools,
    "pools",
    cache_keys::etl::POOLS
);
etl_proxy_raw!(
    proxy_leases_monthly,
    "leases-monthly",
    cache_keys::etl::LEASES_MONTHLY
);
etl_proxy_raw!(
    proxy_leased_assets,
    "leased-assets",
    cache_keys::etl::LEASED_ASSETS
);
etl_proxy_raw!(
    proxy_supplied_funds,
    "supplied-funds",
    cache_keys::etl::SUPPLIED_FUNDS
);
etl_proxy_raw!(
    proxy_unrealized_pnl,
    "unrealized-pnl",
    cache_keys::etl::UNREALIZED_PNL
);

// Typed handlers (ETL API returns objects matching our types)
etl_proxy_typed!(
    proxy_tvl,
    "total-value-locked",
    TvlResponse,
    cache_keys::etl::TVL
);
etl_proxy_typed!(
    proxy_tx_volume,
    "total-tx-value",
    TxVolumeResponse,
    cache_keys::etl::TX_VOLUME
);
etl_proxy_typed!(
    proxy_open_position_value,
    "open-position-value",
    OpenPositionValueResponse,
    cache_keys::etl::OPEN_POSITION_VALUE
);
etl_proxy_typed!(
    proxy_open_interest,
    "open-interest",
    OpenInterestResponse,
    cache_keys::etl::OPEN_INTEREST
);
etl_proxy_typed!(
    proxy_realized_pnl_stats,
    "realized-pnl-stats",
    RealizedPnlStatsResponse,
    cache_keys::etl::REALIZED_PNL_STATS
);
etl_proxy_typed!(
    proxy_buyback_total,
    "buyback-total",
    BuybackTotalResponse,
    cache_keys::etl::BUYBACK_TOTAL
);
etl_proxy_typed!(
    proxy_revenue,
    "revenue",
    RevenueResponse,
    cache_keys::etl::REVENUE
);

// ============================================================================
// Proxy Handlers with Query Parameters
// ============================================================================

// Raw passthrough handlers with params (ETL API returns arrays)
etl_proxy_raw_with_params!(
    proxy_lease_opening,
    "ls-opening",
    ["lease"]
);
etl_proxy_raw_with_params!(
    proxy_price_series,
    "prices",
    ["interval", "key", "protocol"]
);
etl_proxy_raw_with_params!(
    proxy_pnl_over_time,
    "pnl-over-time",
    ["interval", "address"]
);
// Raw passthrough handlers with params (ETL API returns simple objects or arrays)
etl_proxy_raw_with_params!(
    proxy_position_debt_value,
    "position-debt-value",
    ["address"]
);
etl_proxy_raw_with_params!(
    proxy_realized_pnl,
    "realized-pnl",
    ["address"]
);
etl_proxy_raw_with_params!(
    proxy_realized_pnl_data,
    "realized-pnl-data",
    ["address"]
);
etl_proxy_raw_with_params!(
    proxy_time_series,
    "supplied-borrowed-history",
    ["period"]
);
etl_proxy_raw_with_params!(proxy_earnings, "earnings", ["address"]);
etl_proxy_raw_with_params!(proxy_lp_withdraw, "lp-withdraw", ["tx_hash"]);
etl_proxy_raw_with_params!(
    proxy_history_stats,
    "history-stats",
    ["address"]
);

// ============================================================================
// Proxy Handlers with Pagination (all use raw passthrough)
// ============================================================================

etl_proxy_raw_with_params!(
    proxy_pnl,
    "ls-loan-closing",
    ["address", "skip", "limit"]
);

etl_proxy_raw_with_params!(
    proxy_txs,
    "txs",
    ["address", "skip", "limit", "filter", "to"]
);

etl_proxy_raw_with_params!(
    proxy_leases_search,
    "leases-search",
    ["address", "skip", "limit", "search"]
);

// ============================================================================
// POST Proxy Handler
// ============================================================================

/// Proxy handler for /subscribe endpoint (push notifications)
pub async fn proxy_subscribe(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    let url = format!("{}/subscribe", state.config.external.etl_api_url);
    proxy_post(&state.etl_client.client, &url, body).await
}

// ============================================================================
// Batch Endpoints - Fetch multiple resources in parallel
// These return raw JSON to avoid type mismatches with ETL API
// ============================================================================

/// Batch response for stats overview page (raw JSON passthrough)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StatsOverviewBatch {
    pub tvl: Option<serde_json::Value>,
    pub tx_volume: Option<serde_json::Value>,
    pub buyback_total: Option<serde_json::Value>,
    pub realized_pnl_stats: Option<serde_json::Value>,
    pub revenue: Option<serde_json::Value>,
}

/// Batch handler for stats overview
pub async fn batch_stats_overview(
    State(state): State<Arc<AppState>>,
) -> Result<Json<StatsOverviewBatch>, crate::error::AppError> {
    let base_url = state.config.external.etl_api_url.clone();
    let client = state.etl_client.client.clone();

    let result = state
        .cache
        .data
        .get_or_fetch(cache_keys::etl::STATS_OVERVIEW, || async move {
            let url_tvl = format!("{}/api/total-value-locked", base_url);
            let url_tx_volume = format!("{}/api/total-tx-value", base_url);
            let url_buyback = format!("{}/api/buyback-total", base_url);
            let url_realized_pnl = format!("{}/api/realized-pnl-stats", base_url);
            let url_revenue = format!("{}/api/revenue", base_url);

            let (tvl, tx_volume, buyback_total, realized_pnl_stats, revenue) = tokio::join!(
                fetch_json(&client, &url_tvl),
                fetch_json(&client, &url_tx_volume),
                fetch_json(&client, &url_buyback),
                fetch_json(&client, &url_realized_pnl),
                fetch_json(&client, &url_revenue),
            );

            let response = StatsOverviewBatch {
                tvl: tvl.ok(),
                tx_volume: tx_volume.ok(),
                buyback_total: buyback_total.ok(),
                realized_pnl_stats: realized_pnl_stats.ok(),
                revenue: revenue.ok(),
            };

            serde_json::to_value(response)
                .map_err(|e| format!("Failed to serialize batch response: {}", e))
        })
        .await
        .map_err(|e| crate::error::AppError::Internal(e))?;

    let typed: StatsOverviewBatch = serde_json::from_value(result)
        .map_err(|e| crate::error::AppError::Internal(format!("Failed to deserialize: {}", e)))?;

    Ok(Json(typed))
}

/// Batch response for loans stats (raw JSON passthrough)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LoansStatsBatch {
    pub open_position_value: Option<serde_json::Value>,
    pub open_interest: Option<serde_json::Value>,
}

/// Batch handler for loans stats
pub async fn batch_loans_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<LoansStatsBatch>, crate::error::AppError> {
    let base_url = state.config.external.etl_api_url.clone();
    let client = state.etl_client.client.clone();

    let result = state
        .cache
        .data
        .get_or_fetch(cache_keys::etl::LOANS_STATS, || async move {
            let url_open_position = format!("{}/api/open-position-value", base_url);
            let url_open_interest = format!("{}/api/open-interest", base_url);

            let (open_position_value, open_interest) = tokio::join!(
                fetch_json(&client, &url_open_position),
                fetch_json(&client, &url_open_interest),
            );

            let response = LoansStatsBatch {
                open_position_value: open_position_value.ok(),
                open_interest: open_interest.ok(),
            };

            serde_json::to_value(response)
                .map_err(|e| format!("Failed to serialize batch response: {}", e))
        })
        .await
        .map_err(|e| crate::error::AppError::Internal(e))?;

    let typed: LoansStatsBatch = serde_json::from_value(result)
        .map_err(|e| crate::error::AppError::Internal(format!("Failed to deserialize: {}", e)))?;

    Ok(Json(typed))
}

/// Batch response for user dashboard data (raw JSON passthrough)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserDashboardBatch {
    pub earnings: Option<serde_json::Value>,
    pub realized_pnl: Option<serde_json::Value>,
    pub position_debt_value: Option<serde_json::Value>,
}

/// Batch handler for user dashboard
pub async fn batch_user_dashboard(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ProxyQuery>,
) -> Result<Json<UserDashboardBatch>, crate::error::AppError> {
    let base_url = state.config.external.etl_api_url.clone();
    let client = state.etl_client.client.clone();
    let address = query.params.get("address").cloned().unwrap_or_default();

    let url_earnings = format!("{}/api/earnings?address={}", base_url, address);
    let url_realized_pnl = format!("{}/api/realized-pnl?address={}", base_url, address);
    let url_position_debt = format!("{}/api/position-debt-value?address={}", base_url, address);

    let (earnings, realized_pnl, position_debt_value) = tokio::join!(
        fetch_json(&client, &url_earnings),
        fetch_json(&client, &url_realized_pnl),
        fetch_json(&client, &url_position_debt),
    );

    let response = UserDashboardBatch {
        earnings: earnings.ok(),
        realized_pnl: realized_pnl.ok(),
        position_debt_value: position_debt_value.ok(),
    };

    Ok(Json(response))
}

/// Batch response for user history page (raw JSON passthrough)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserHistoryBatch {
    pub history_stats: Option<serde_json::Value>,
    pub realized_pnl_data: Option<serde_json::Value>,
}

/// Batch handler for user history
pub async fn batch_user_history(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ProxyQuery>,
) -> Result<Json<UserHistoryBatch>, crate::error::AppError> {
    let base_url = state.config.external.etl_api_url.clone();
    let client = state.etl_client.client.clone();
    let address = query.params.get("address").cloned().unwrap_or_default();

    let url_history_stats = format!("{}/api/history-stats?address={}", base_url, address);
    let url_realized_pnl_data = format!("{}/api/realized-pnl-data?address={}", base_url, address);

    let (history_stats, realized_pnl_data) = tokio::join!(
        fetch_json(&client, &url_history_stats),
        fetch_json(&client, &url_realized_pnl_data),
    );

    let response = UserHistoryBatch {
        history_stats: history_stats.ok(),
        realized_pnl_data: realized_pnl_data.ok(),
    };

    Ok(Json(response))
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

/// Helper to fetch JSON from ETL API (used by batch handlers)
pub async fn fetch_json(client: &Client, url: &str) -> Result<serde_json::Value, String> {
    debug!("Batch fetching: {}", url);
    client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())
}

/// Internal helper to make POST request to ETL API and return response
/// Uses shared HTTP client from AppState for connection pooling
async fn proxy_post(client: &Client, url: &str, body: serde_json::Value) -> impl IntoResponse {
    debug!("Proxying POST request to: {}", url);

    match client
        .post(url)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();
            match response.text().await {
                Ok(body) => (
                    StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::OK),
                    [("content-type", "application/json")],
                    body,
                )
                    .into_response(),
                Err(e) => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({
                        "error": "Failed to read response",
                        "message": e.to_string()
                    })),
                )
                    .into_response(),
            }
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(serde_json::json!({
                "error": "ETL API request failed",
                "message": e.to_string()
            })),
        )
            .into_response(),
    }
}

// ============================================================================
// Tests
// ============================================================================
