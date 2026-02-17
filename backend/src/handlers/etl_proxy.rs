//! ETL API proxy handlers
//!
//! This module provides proxy handlers for the ETL (Extract-Transform-Load) API.
//!
//! Simple passthrough endpoints use a single generic handler with an allowlist.
//! Complex handlers (batch, enriched transactions) are implemented explicitly.

use std::collections::HashSet;
use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use lazy_static::lazy_static;
use reqwest::Client;
use serde::Deserialize;
use tracing::{debug, warn};

use crate::error::AppError;
use crate::AppState;

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
// Generic ETL Proxy (replaces all macro-generated passthrough handlers)
// ============================================================================

lazy_static! {
    /// Allowlist of ETL API paths that can be proxied through the generic handler.
    /// Only paths in this set are forwarded; all others return 404.
    static ref ETL_ALLOWED_PATHS: HashSet<&'static str> = HashSet::from([
        "pools",
        "leases-monthly",
        "leased-assets",
        "supplied-funds",
        "unrealized-pnl",
        "total-value-locked",
        "total-tx-value",
        "open-position-value",
        "open-interest",
        "realized-pnl-stats",
        "buyback-total",
        "revenue",
        "ls-opening",
        "prices",
        "pnl-over-time",
        "position-debt-value",
        "realized-pnl",
        "realized-pnl-data",
        "supplied-borrowed-history",
        "earnings",
        "lp-withdraw",
        "history-stats",
        "ls-loan-closing",
        "leases-search",
    ]);
}

/// Generic ETL proxy handler — forwards GET requests to ETL API for allowed paths.
/// Query parameters are passed through as-is.
pub async fn etl_proxy_generic(
    State(state): State<Arc<AppState>>,
    Path(path): Path<String>,
    Query(query): Query<ProxyQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    if !ETL_ALLOWED_PATHS.contains(path.as_str()) {
        return Err(AppError::NotFound {
            resource: format!("ETL endpoint: {}", path),
        });
    }

    let base_url = &state.config.external.etl_api_url;

    let params: Vec<String> = query
        .params
        .iter()
        .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
        .collect();

    let url = if params.is_empty() {
        format!("{}/api/{}", base_url, path)
    } else {
        format!("{}/api/{}?{}", base_url, path, params.join("&"))
    };

    debug!("ETL proxy: {}", url);

    let response = state
        .etl_client
        .client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::ExternalApi {
            api: "ETL".to_string(),
            message: format!("Request failed: {}", e),
        })?;

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse ETL response: {}", e)))?;

    Ok(Json(json))
}

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
/// Reads from background-refreshed cache (zero latency).
pub async fn batch_stats_overview(
    State(state): State<Arc<AppState>>,
) -> Result<Json<StatsOverviewBatch>, crate::error::AppError> {
    let response = state.data_cache.stats_overview.load_or_unavailable("Stats overview")?;

    Ok(Json(response))
}

/// Batch response for loans stats (raw JSON passthrough)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LoansStatsBatch {
    pub open_position_value: Option<serde_json::Value>,
    pub open_interest: Option<serde_json::Value>,
}

/// Batch handler for loans stats
/// Reads from background-refreshed cache (zero latency).
pub async fn batch_loans_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<LoansStatsBatch>, crate::error::AppError> {
    let response = state.data_cache.loans_stats.load_or_unavailable("Loans stats")?;

    Ok(Json(response))
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
        earnings: ok_or_warn(earnings, "earnings"),
        realized_pnl: ok_or_warn(realized_pnl, "realized-pnl"),
        position_debt_value: ok_or_warn(position_debt_value, "position-debt-value"),
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
        history_stats: ok_or_warn(history_stats, "history-stats"),
        realized_pnl_data: ok_or_warn(realized_pnl_data, "realized-pnl-data"),
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

/// Convert Result to Option with warning log on error
fn ok_or_warn<T>(result: Result<T, String>, endpoint: &str) -> Option<T> {
    match result {
        Ok(v) => Some(v),
        Err(e) => {
            warn!("ETL batch fetch failed for {}: {}", endpoint, e);
            None
        }
    }
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
                Err(e) => AppError::Internal(format!("Failed to read ETL response: {}", e))
                    .into_response(),
            }
        }
        Err(e) => AppError::ExternalApi {
            api: "ETL".to_string(),
            message: e.to_string(),
        }
        .into_response(),
    }
}

// ============================================================================
// Tests
// ============================================================================
