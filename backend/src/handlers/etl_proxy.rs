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
use utoipa::ToSchema;

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

/// Generic ETL passthrough
///
/// Forwards GET requests to the upstream ETL API for a fixed allowlist of
/// paths. Query parameters are passed through verbatim. Response is an opaque
/// ETL API passthrough — shape is not fixed in this spec.
#[utoipa::path(
    get,
    path = "/api/etl/{path}",
    tag = "etl",
    params(
        ("path" = String, Path, description = "Target ETL endpoint (allowlisted server-side)"),
    ),
    responses(
        (status = 200, description = "Opaque ETL API passthrough", content_type = "application/json", body = Object),
        (status = 404, description = "ETL endpoint not in allowlist", body = crate::error::ErrorResponse),
        (status = 502, description = "Upstream ETL call failed", body = crate::error::ErrorResponse),
    ),
)]
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

/// Subscribe to push notifications
///
/// Opaque passthrough to the ETL `/subscribe` endpoint. Request and response
/// bodies are opaque JSON — shapes are not fixed in this spec.
#[utoipa::path(
    post,
    path = "/api/etl/subscribe",
    tag = "etl",
    request_body(content_type = "application/json", content = Object, description = "Opaque ETL subscribe payload"),
    responses(
        (status = 200, description = "Opaque ETL API passthrough", content_type = "application/json", body = Object),
        (status = 502, description = "Upstream ETL call failed", body = crate::error::ErrorResponse),
    ),
)]
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
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct StatsOverviewBatch {
    #[schema(value_type = Object, nullable = true)]
    pub tvl: Option<serde_json::Value>,
    #[schema(value_type = Object, nullable = true)]
    pub tx_volume: Option<serde_json::Value>,
    #[schema(value_type = Object, nullable = true)]
    pub buyback_total: Option<serde_json::Value>,
    #[schema(value_type = Object, nullable = true)]
    pub realized_pnl_stats: Option<serde_json::Value>,
    #[schema(value_type = Object, nullable = true)]
    pub revenue: Option<serde_json::Value>,
}

/// Stats overview batch
///
/// Aggregates several ETL stats endpoints into one response, served from
/// background-refreshed cache. Each field is an opaque ETL passthrough.
#[utoipa::path(
    get,
    path = "/api/etl/batch/stats-overview",
    tag = "etl",
    responses(
        (status = 200, description = "Batch of opaque ETL passthroughs", body = StatsOverviewBatch),
        (status = 503, description = "Cache not yet populated", body = crate::error::ErrorResponse),
    ),
)]
pub async fn batch_stats_overview(
    State(state): State<Arc<AppState>>,
) -> Result<Json<StatsOverviewBatch>, crate::error::AppError> {
    let response = state
        .data_cache
        .stats_overview
        .load_or_unavailable("Stats overview")?;

    Ok(Json(response))
}

/// Batch response for loans stats (raw JSON passthrough)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct LoansStatsBatch {
    #[schema(value_type = Object, nullable = true)]
    pub open_position_value: Option<serde_json::Value>,
    #[schema(value_type = Object, nullable = true)]
    pub open_interest: Option<serde_json::Value>,
}

/// Loans stats batch
///
/// Aggregates loan stats endpoints into one response, served from
/// background-refreshed cache. Each field is an opaque ETL passthrough.
#[utoipa::path(
    get,
    path = "/api/etl/batch/loans-stats",
    tag = "etl",
    responses(
        (status = 200, description = "Batch of opaque ETL passthroughs", body = LoansStatsBatch),
        (status = 503, description = "Cache not yet populated", body = crate::error::ErrorResponse),
    ),
)]
pub async fn batch_loans_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<LoansStatsBatch>, crate::error::AppError> {
    let response = state
        .data_cache
        .loans_stats
        .load_or_unavailable("Loans stats")?;

    Ok(Json(response))
}

/// Batch response for user dashboard data (raw JSON passthrough)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct UserDashboardBatch {
    #[schema(value_type = Object, nullable = true)]
    pub earnings: Option<serde_json::Value>,
    #[schema(value_type = Object, nullable = true)]
    pub realized_pnl: Option<serde_json::Value>,
    #[schema(value_type = Object, nullable = true)]
    pub position_debt_value: Option<serde_json::Value>,
}

/// User dashboard batch
///
/// Aggregates earnings, realized PnL, and position debt for an address in
/// parallel. Each field is an opaque ETL passthrough.
#[utoipa::path(
    get,
    path = "/api/etl/batch/user-dashboard",
    tag = "etl",
    params(
        ("address" = String, Query, description = "Nolus bech32 address"),
    ),
    responses(
        (status = 200, description = "Batch of opaque ETL passthroughs", body = UserDashboardBatch),
        (status = 502, description = "Upstream ETL call failed", body = crate::error::ErrorResponse),
    ),
)]
pub async fn batch_user_dashboard(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ProxyQuery>,
) -> Result<Json<UserDashboardBatch>, crate::error::AppError> {
    let base_url = state.config.external.etl_api_url.clone();
    let client = state.etl_client.client.clone();
    let address = query.params.get("address").cloned().unwrap_or_default();

    let encoded_address = urlencoding::encode(&address);
    let url_earnings = format!("{}/api/earnings?address={}", base_url, encoded_address);
    let url_realized_pnl = format!("{}/api/realized-pnl?address={}", base_url, encoded_address);
    let url_position_debt = format!(
        "{}/api/position-debt-value?address={}",
        base_url, encoded_address
    );

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
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, ToSchema)]
pub struct UserHistoryBatch {
    #[schema(value_type = Object, nullable = true)]
    pub history_stats: Option<serde_json::Value>,
    #[schema(value_type = Object, nullable = true)]
    pub realized_pnl_data: Option<serde_json::Value>,
}

/// User history batch
///
/// Aggregates history stats and realized PnL data for an address in parallel.
/// Each field is an opaque ETL passthrough.
#[utoipa::path(
    get,
    path = "/api/etl/batch/user-history",
    tag = "etl",
    params(
        ("address" = String, Query, description = "Nolus bech32 address"),
    ),
    responses(
        (status = 200, description = "Batch of opaque ETL passthroughs", body = UserHistoryBatch),
        (status = 502, description = "Upstream ETL call failed", body = crate::error::ErrorResponse),
    ),
)]
pub async fn batch_user_history(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ProxyQuery>,
) -> Result<Json<UserHistoryBatch>, crate::error::AppError> {
    let base_url = state.config.external.etl_api_url.clone();
    let client = state.etl_client.client.clone();
    let address = query.params.get("address").cloned().unwrap_or_default();

    let encoded_address = urlencoding::encode(&address);
    let url_history_stats = format!("{}/api/history-stats?address={}", base_url, encoded_address);
    let url_realized_pnl_data = format!(
        "{}/api/realized-pnl-data?address={}",
        base_url, encoded_address
    );

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
        .error_for_status()
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
    use wiremock::matchers::{method, path as wm_path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn build_app(state: Arc<AppState>) -> Router {
        Router::new()
            .route("/api/etl/{path}", get(etl_proxy_generic))
            .route("/api/etl/subscribe", post(proxy_subscribe))
            .route("/api/etl/batch/user-dashboard", get(batch_user_dashboard))
            .with_state(state)
    }

    /// Build an AppState where the shared HTTP client has a realistic
    /// timeout (so etl_proxy wiremock requests actually resolve) and
    /// etl_api_url points at the given mock URL. Mirrors `test_app_state`
    /// but substitutes a real-timeout client for the throttled one.
    async fn state_with_etl_url(etl_url: &str) -> Arc<AppState> {
        use crate::config_store::ConfigStore;
        use crate::translations::{
            llm::{LlmClient, LlmConfig},
            TranslationStorage,
        };

        let mut cfg = crate::test_utils::test_config();
        cfg.external.etl_api_url = etl_url.to_string();

        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .expect("reqwest client");

        let etl_client = crate::external::etl::EtlClient::new(
            cfg.external.etl_api_url.clone(),
            http_client.clone(),
        );
        let skip_client = crate::external::skip::SkipClient::new(
            cfg.external.skip_api_url.clone(),
            cfg.external.skip_api_key.clone(),
            http_client.clone(),
        );
        let chain_client = crate::external::chain::ChainClient::new(
            cfg.external.nolus_rest_url.clone(),
            http_client.clone(),
        );
        let referral_client =
            crate::external::referral::ReferralClient::new(&cfg, http_client.clone());
        let zero_interest_client =
            crate::external::zero_interest::ZeroInterestClient::new(&cfg, http_client.clone());

        let config_dir = tempfile::tempdir().expect("tempdir").keep();
        let config_store = ConfigStore::new(&config_dir);
        config_store.init().await.expect("ConfigStore init");
        let translation_dir = tempfile::tempdir().expect("tempdir").keep();
        let translation_storage = TranslationStorage::new(&translation_dir);
        translation_storage.init().await.expect("TS init");
        let llm_client = LlmClient::new(LlmConfig {
            api_key: String::new(),
            model: "stub".to_string(),
            base_url: Some("http://127.0.0.1:1/".to_string()),
        });

        Arc::new(crate::AppState {
            config: cfg,
            etl_client,
            skip_client,
            chain_client,
            referral_client,
            zero_interest_client,
            data_cache: crate::data_cache::AppDataCache::new(),
            ws_manager: crate::handlers::websocket::WebSocketManager::new(16),
            config_store,
            translation_storage,
            llm_client,
            startup_time: std::time::Instant::now(),
        })
    }

    #[tokio::test]
    async fn etl_proxy_unknown_path_returns_404() {
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/etl/not-in-allowlist")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
        let body = collect_body_str(resp).await;
        assert!(body.contains("not-in-allowlist"), "body: {body}");
    }

    #[tokio::test]
    async fn etl_proxy_allowed_path_forwards_and_returns_200() {
        let mock_server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(wm_path("/api/pools"))
            .respond_with(
                ResponseTemplate::new(200)
                    .set_body_json(serde_json::json!({"pools":[{"protocol":"P"}]})),
            )
            .mount(&mock_server)
            .await;

        let state = state_with_etl_url(&mock_server.uri()).await;
        let app = build_app(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/etl/pools")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = collect_body_str(resp).await;
        assert!(body.contains("\"pools\""), "body: {body}");
        assert!(body.contains("\"protocol\":\"P\""), "body: {body}");
    }

    #[tokio::test]
    async fn etl_proxy_upstream_500_propagates_as_internal_error() {
        let mock_server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(wm_path("/api/pools"))
            .respond_with(ResponseTemplate::new(500).set_body_string("<html>boom</html>"))
            .mount(&mock_server)
            .await;

        let state = state_with_etl_url(&mock_server.uri()).await;
        let app = build_app(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/etl/pools")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        // Body is HTML so parse-to-json fails → AppError::Internal → 500
        assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
    }
}
