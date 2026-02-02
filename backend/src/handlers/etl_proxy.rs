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

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use reqwest::Client;
use serde::Deserialize;
use tracing::debug;

use crate::AppState;

// Re-export macros for use in this module
use crate::{
    etl_proxy_typed, etl_proxy_typed_with_params, etl_proxy_typed_paginated,
    etl_batch_handler_typed,
};
use crate::cache_keys;

// Import typed response types
use super::etl_types::{
    TvlResponse, TxVolumeResponse, BuybackTotalResponse, RevenueResponse,
    OpenPositionValueResponse, OpenInterestResponse, UnrealizedPnlResponse,
    RealizedPnlStatsResponse, SuppliedFundsResponse, LeasedAssetsResponse,
    PoolsResponse, EarnAprResponse, LeasesMonthlyResponse,
    LeaseOpeningResponse, LeaseClosingResponse, LeasesSearchResponse,
    TxsResponse, LpWithdrawResponse, EarningsResponse, UserRealizedPnlResponse,
    RealizedPnlDataResponse, PositionDebtValueResponse, HistoryStatsResponse,
    PnlOverTimeResponse, PriceSeriesResponse, TimeSeriesResponse,
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

etl_proxy_typed!(proxy_pools, "pools", PoolsResponse, cache_keys::etl::POOLS);
etl_proxy_typed!(proxy_tvl, "total-value-locked", TvlResponse, cache_keys::etl::TVL);
etl_proxy_typed!(proxy_tx_volume, "total-tx-value", TxVolumeResponse, cache_keys::etl::TX_VOLUME);
etl_proxy_typed!(proxy_leases_monthly, "leases-monthly", LeasesMonthlyResponse, cache_keys::etl::LEASES_MONTHLY);
etl_proxy_typed!(proxy_open_position_value, "open-position-value", OpenPositionValueResponse, cache_keys::etl::OPEN_POSITION_VALUE);
etl_proxy_typed!(proxy_open_interest, "open-interest", OpenInterestResponse, cache_keys::etl::OPEN_INTEREST);
etl_proxy_typed!(proxy_unrealized_pnl, "unrealized-pnl", UnrealizedPnlResponse, cache_keys::etl::UNREALIZED_PNL);
etl_proxy_typed!(proxy_realized_pnl_stats, "realized-pnl-stats", RealizedPnlStatsResponse, cache_keys::etl::REALIZED_PNL_STATS);
etl_proxy_typed!(proxy_supplied_funds, "supplied-funds", SuppliedFundsResponse, cache_keys::etl::SUPPLIED_FUNDS);
etl_proxy_typed!(proxy_leased_assets, "leased-assets", LeasedAssetsResponse, cache_keys::etl::LEASED_ASSETS);
etl_proxy_typed!(proxy_buyback_total, "buyback-total", BuybackTotalResponse, cache_keys::etl::BUYBACK_TOTAL);
etl_proxy_typed!(proxy_revenue, "revenue", RevenueResponse, cache_keys::etl::REVENUE);

// ============================================================================
// Proxy Handlers with Query Parameters
// ============================================================================

etl_proxy_typed_with_params!(proxy_earn_apr, "earn-apr", EarnAprResponse, ["protocol"]);
etl_proxy_typed_with_params!(proxy_lease_opening, "ls-opening", LeaseOpeningResponse, ["lease"]);
etl_proxy_typed_with_params!(proxy_price_series, "prices", PriceSeriesResponse, ["interval", "key", "protocol"]);
etl_proxy_typed_with_params!(proxy_pnl_over_time, "pnl-over-time", PnlOverTimeResponse, ["interval", "address"]);
etl_proxy_typed_with_params!(proxy_position_debt_value, "position-debt-value", PositionDebtValueResponse, ["address"]);
etl_proxy_typed_with_params!(proxy_realized_pnl, "realized-pnl", UserRealizedPnlResponse, ["address"]);
etl_proxy_typed_with_params!(proxy_realized_pnl_data, "realized-pnl-data", RealizedPnlDataResponse, ["address"]);
etl_proxy_typed_with_params!(proxy_time_series, "supplied-borrowed-history", TimeSeriesResponse, ["period"]);
etl_proxy_typed_with_params!(proxy_earnings, "earnings", EarningsResponse, ["address"]);
etl_proxy_typed_with_params!(proxy_lp_withdraw, "lp-withdraw", LpWithdrawResponse, ["tx"]);
etl_proxy_typed_with_params!(proxy_history_stats, "history-stats", HistoryStatsResponse, ["address"]);

// ============================================================================
// Proxy Handlers with Pagination
// ============================================================================

etl_proxy_typed_paginated!(
    proxy_pnl,
    "ls-loan-closing",
    LeaseClosingResponse,
    required: ["address"],
    optional: [],
    defaults: [("skip", "0"), ("limit", "10")]
);

etl_proxy_typed_paginated!(
    proxy_txs,
    "txs",
    TxsResponse,
    required: ["address"],
    optional: ["filter", "to"],
    defaults: [("skip", "0"), ("limit", "10")]
);

etl_proxy_typed_paginated!(
    proxy_leases_search,
    "leases-search",
    LeasesSearchResponse,
    required: ["address"],
    optional: ["search"],
    defaults: [("skip", "0"), ("limit", "10")]
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
// ============================================================================

/// Batch response for stats overview page
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StatsOverviewBatch {
    pub tvl: Option<TvlResponse>,
    pub tx_volume: Option<TxVolumeResponse>,
    pub buyback_total: Option<BuybackTotalResponse>,
    pub realized_pnl_stats: Option<RealizedPnlStatsResponse>,
    pub revenue: Option<RevenueResponse>,
}

etl_batch_handler_typed!(
    batch_stats_overview,
    StatsOverviewBatch,
    cache_keys::etl::STATS_OVERVIEW,
    [
        (tvl, "total-value-locked", TvlResponse),
        (tx_volume, "total-tx-value", TxVolumeResponse),
        (buyback_total, "buyback-total", BuybackTotalResponse),
        (realized_pnl_stats, "realized-pnl-stats", RealizedPnlStatsResponse),
        (revenue, "revenue", RevenueResponse),
    ]
);

/// Batch response for loans stats
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LoansStatsBatch {
    pub open_position_value: Option<OpenPositionValueResponse>,
    pub open_interest: Option<OpenInterestResponse>,
}

etl_batch_handler_typed!(
    batch_loans_stats,
    LoansStatsBatch,
    cache_keys::etl::LOANS_STATS,
    [
        (open_position_value, "open-position-value", OpenPositionValueResponse),
        (open_interest, "open-interest", OpenInterestResponse),
    ]
);

/// Batch response for user dashboard data
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserDashboardBatch {
    pub earnings: Option<EarningsResponse>,
    pub realized_pnl: Option<UserRealizedPnlResponse>,
    pub position_debt_value: Option<PositionDebtValueResponse>,
}

etl_batch_handler_typed!(
    batch_user_dashboard,
    UserDashboardBatch,
    cache_keys::etl::USER_DASHBOARD,
    [
        (earnings, "earnings", EarningsResponse),
        (realized_pnl, "realized-pnl", UserRealizedPnlResponse),
        (position_debt_value, "position-debt-value", PositionDebtValueResponse),
    ]
);

/// Batch response for user history page
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserHistoryBatch {
    pub history_stats: Option<HistoryStatsResponse>,
    pub realized_pnl_data: Option<RealizedPnlDataResponse>,
}

etl_batch_handler_typed!(
    batch_user_history,
    UserHistoryBatch,
    cache_keys::etl::USER_HISTORY,
    [
        (history_stats, "history-stats", HistoryStatsResponse),
        (realized_pnl_data, "realized-pnl-data", RealizedPnlDataResponse),
    ]
);

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

