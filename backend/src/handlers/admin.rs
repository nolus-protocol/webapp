use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::time::{timeout, Duration};
use tracing::{debug, warn};

use crate::error::AppError;
use crate::AppState;

// ============================================================================
// Health Check Types
// ============================================================================

/// Basic health response (for quick checks)
#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
    pub uptime_seconds: u64,
}

/// Detailed health response with service checks
#[derive(Debug, Serialize, Deserialize)]
pub struct DetailedHealthResponse {
    pub status: String,
    pub version: String,
    pub uptime_seconds: u64,
    pub services: ServiceHealth,
    pub cache: CacheHealth,
}

/// Health status of external services
#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceHealth {
    pub etl_api: ServiceStatus,
    pub nolus_rpc: ServiceStatus,
    pub nolus_rest: ServiceStatus,
    pub skip_api: ServiceStatus,
    pub referral_api: ServiceStatus,
    pub zero_interest_api: ServiceStatus,
}

/// Health status of a single service
#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceStatus {
    pub status: String,
    pub configured: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl ServiceStatus {
    fn healthy(latency_ms: u64) -> Self {
        Self {
            status: "healthy".to_string(),
            configured: true,
            latency_ms: Some(latency_ms),
            error: None,
        }
    }

    fn unhealthy(error: String) -> Self {
        Self {
            status: "unhealthy".to_string(),
            configured: true,
            latency_ms: None,
            error: Some(error),
        }
    }

    fn not_configured() -> Self {
        Self {
            status: "not_configured".to_string(),
            configured: false,
            latency_ms: None,
            error: None,
        }
    }

    fn timeout() -> Self {
        Self {
            status: "timeout".to_string(),
            configured: true,
            latency_ms: None,
            error: Some("Request timed out".to_string()),
        }
    }
}

/// Cache health information
#[derive(Debug, Serialize, Deserialize)]
pub struct CacheHealth {
    pub status: String,
    pub total_entries: u64,
    pub hit_rate: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CacheStatsResponse {
    pub prices_cache_size: u64,
    pub config_cache_size: u64,
    pub apr_cache_size: u64,
    pub data_cache_size: u64,
    pub total_hit_rate: f64,
    pub prices_hit_rate: f64,
    pub config_hit_rate: f64,
    pub apr_hit_rate: f64,
    pub data_hit_rate: f64,
    pub total_hits: u64,
    pub total_misses: u64,
}

#[derive(Debug, Deserialize)]
pub struct InvalidateCacheRequest {
    pub cache_type: Option<String>,
    pub key: Option<String>,
}

/// Request for Intercom JWT token generation
/// Matches beacon's API: POST /intercom with { wallet: "..." }
#[derive(Debug, Serialize, Deserialize)]
pub struct IntercomTokenRequest {
    pub wallet: String,
    /// Optional wallet type for user segmentation (e.g., "keplr", "leap", "ledger")
    pub wallet_type: Option<String>,
}

/// Response containing JWT token for Intercom
/// Matches beacon's API response: { token: "..." }
#[derive(Debug, Serialize, Deserialize)]
pub struct IntercomTokenResponse {
    pub token: String,
}

/// GET /api/health
/// Basic health check endpoint (public, fast)
pub async fn health_check(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: state.startup_time.elapsed().as_secs(),
    })
}

/// GET /api/health/detailed
/// Detailed health check with service connectivity verification (public)
/// This endpoint performs actual connectivity checks to external services.
pub async fn detailed_health_check(
    State(state): State<Arc<AppState>>,
) -> Json<DetailedHealthResponse> {
    const CHECK_TIMEOUT: Duration = Duration::from_secs(5);

    // Check all services in parallel
    let (etl_status, nolus_rpc_status, nolus_rest_status, skip_status, referral_status, zero_interest_status) = tokio::join!(
        check_etl_health(&state, CHECK_TIMEOUT),
        check_nolus_rpc_health(&state, CHECK_TIMEOUT),
        check_nolus_rest_health(&state, CHECK_TIMEOUT),
        check_skip_health(&state, CHECK_TIMEOUT),
        check_referral_health(&state, CHECK_TIMEOUT),
        check_zero_interest_health(&state, CHECK_TIMEOUT),
    );

    // Calculate overall status
    let critical_healthy = etl_status.status == "healthy"
        && nolus_rpc_status.status == "healthy"
        && nolus_rest_status.status == "healthy";

    let overall_status = if critical_healthy {
        "healthy"
    } else if etl_status.status == "healthy" || nolus_rest_status.status == "healthy" {
        "degraded"
    } else {
        "unhealthy"
    };

    // Cache health
    let stats = state.cache.total_stats();
    let total_entries = state.cache.prices.entry_count()
        + state.cache.config.entry_count()
        + state.cache.apr.entry_count()
        + state.cache.data.entry_count();

    let cache_status = if total_entries > 0 { "healthy" } else { "empty" };

    Json(DetailedHealthResponse {
        status: overall_status.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_seconds: state.startup_time.elapsed().as_secs(),
        services: ServiceHealth {
            etl_api: etl_status,
            nolus_rpc: nolus_rpc_status,
            nolus_rest: nolus_rest_status,
            skip_api: skip_status,
            referral_api: referral_status,
            zero_interest_api: zero_interest_status,
        },
        cache: CacheHealth {
            status: cache_status.to_string(),
            total_entries,
            hit_rate: stats.hit_rate,
        },
    })
}

/// Check ETL API health by fetching pools endpoint
async fn check_etl_health(state: &AppState, timeout_duration: Duration) -> ServiceStatus {
    let url = &state.config.external.etl_api_url;
    if url.is_empty() {
        return ServiceStatus::not_configured();
    }

    let check_url = format!("{}/pools", url);
    debug!("Health check: ETL API at {}", check_url);

    let start = std::time::Instant::now();
    match timeout(timeout_duration, state.etl_client.client.get(&check_url).send()).await {
        Ok(Ok(response)) => {
            let latency = start.elapsed().as_millis() as u64;
            if response.status().is_success() {
                ServiceStatus::healthy(latency)
            } else {
                ServiceStatus::unhealthy(format!("HTTP {}", response.status()))
            }
        }
        Ok(Err(e)) => {
            warn!("ETL health check failed: {}", e);
            ServiceStatus::unhealthy(e.to_string())
        }
        Err(_) => ServiceStatus::timeout(),
    }
}

/// Check Nolus RPC health by fetching status endpoint
async fn check_nolus_rpc_health(state: &AppState, timeout_duration: Duration) -> ServiceStatus {
    let url = &state.config.external.nolus_rpc_url;
    if url.is_empty() {
        return ServiceStatus::not_configured();
    }

    let check_url = format!("{}/status", url);
    debug!("Health check: Nolus RPC at {}", check_url);

    let start = std::time::Instant::now();
    match timeout(
        timeout_duration,
        state.chain_client.http_client().get(&check_url).send(),
    )
    .await
    {
        Ok(Ok(response)) => {
            let latency = start.elapsed().as_millis() as u64;
            if response.status().is_success() {
                ServiceStatus::healthy(latency)
            } else {
                ServiceStatus::unhealthy(format!("HTTP {}", response.status()))
            }
        }
        Ok(Err(e)) => {
            warn!("Nolus RPC health check failed: {}", e);
            ServiceStatus::unhealthy(e.to_string())
        }
        Err(_) => ServiceStatus::timeout(),
    }
}

/// Check Nolus REST health by fetching node info
async fn check_nolus_rest_health(state: &AppState, timeout_duration: Duration) -> ServiceStatus {
    let url = &state.config.external.nolus_rest_url;
    if url.is_empty() {
        return ServiceStatus::not_configured();
    }

    let check_url = format!("{}/cosmos/base/tendermint/v1beta1/node_info", url);
    debug!("Health check: Nolus REST at {}", check_url);

    let start = std::time::Instant::now();
    match timeout(
        timeout_duration,
        state.chain_client.http_client().get(&check_url).send(),
    )
    .await
    {
        Ok(Ok(response)) => {
            let latency = start.elapsed().as_millis() as u64;
            if response.status().is_success() {
                ServiceStatus::healthy(latency)
            } else {
                ServiceStatus::unhealthy(format!("HTTP {}", response.status()))
            }
        }
        Ok(Err(e)) => {
            warn!("Nolus REST health check failed: {}", e);
            ServiceStatus::unhealthy(e.to_string())
        }
        Err(_) => ServiceStatus::timeout(),
    }
}

/// Check Skip API health
async fn check_skip_health(state: &AppState, timeout_duration: Duration) -> ServiceStatus {
    let url = &state.config.external.skip_api_url;
    if url.is_empty() {
        return ServiceStatus::not_configured();
    }

    // Skip API v2 info endpoint
    let check_url = format!("{}/v2/info/chains", url);
    debug!("Health check: Skip API at {}", check_url);

    let start = std::time::Instant::now();
    match timeout(
        timeout_duration,
        state.chain_client.http_client().get(&check_url).send(),
    )
    .await
    {
        Ok(Ok(response)) => {
            let latency = start.elapsed().as_millis() as u64;
            if response.status().is_success() {
                ServiceStatus::healthy(latency)
            } else {
                ServiceStatus::unhealthy(format!("HTTP {}", response.status()))
            }
        }
        Ok(Err(e)) => {
            warn!("Skip API health check failed: {}", e);
            ServiceStatus::unhealthy(e.to_string())
        }
        Err(_) => ServiceStatus::timeout(),
    }
}

/// Check Referral API health
async fn check_referral_health(state: &AppState, timeout_duration: Duration) -> ServiceStatus {
    let url = &state.config.external.referral_api_url;
    if url.is_empty() {
        return ServiceStatus::not_configured();
    }

    // Try to validate a dummy code (will return 404 but confirms connectivity)
    let check_url = format!("{}/api/referrals/validate/HEALTH_CHECK", url);
    debug!("Health check: Referral API at {}", check_url);

    let start = std::time::Instant::now();
    match timeout(
        timeout_duration,
        state.chain_client.http_client().get(&check_url).send(),
    )
    .await
    {
        Ok(Ok(response)) => {
            let latency = start.elapsed().as_millis() as u64;
            // 404 is expected for invalid code, 200 means API is working
            if response.status().is_success() || response.status() == reqwest::StatusCode::NOT_FOUND
            {
                ServiceStatus::healthy(latency)
            } else {
                ServiceStatus::unhealthy(format!("HTTP {}", response.status()))
            }
        }
        Ok(Err(e)) => {
            warn!("Referral API health check failed: {}", e);
            ServiceStatus::unhealthy(e.to_string())
        }
        Err(_) => ServiceStatus::timeout(),
    }
}

/// Check Zero Interest API health
async fn check_zero_interest_health(state: &AppState, timeout_duration: Duration) -> ServiceStatus {
    let url = &state.config.external.zero_interest_api_url;
    if url.is_empty() {
        return ServiceStatus::not_configured();
    }

    // Check campaigns endpoint
    let check_url = format!("{}/api/v1/campaigns/active", url);
    debug!("Health check: Zero Interest API at {}", check_url);

    let start = std::time::Instant::now();
    match timeout(
        timeout_duration,
        state.chain_client.http_client().get(&check_url).send(),
    )
    .await
    {
        Ok(Ok(response)) => {
            let latency = start.elapsed().as_millis() as u64;
            // 401 means API is reachable but needs auth, which is fine for health check
            if response.status().is_success()
                || response.status() == reqwest::StatusCode::UNAUTHORIZED
            {
                ServiceStatus::healthy(latency)
            } else {
                ServiceStatus::unhealthy(format!("HTTP {}", response.status()))
            }
        }
        Ok(Err(e)) => {
            warn!("Zero Interest API health check failed: {}", e);
            ServiceStatus::unhealthy(e.to_string())
        }
        Err(_) => ServiceStatus::timeout(),
    }
}

/// GET /api/admin/cache/stats
/// Get cache statistics (admin only)
/// Note: Authentication is handled by the admin_auth_middleware layer
pub async fn get_cache_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<CacheStatsResponse>, AppError> {
    let stats = state.cache.total_stats();

    Ok(Json(CacheStatsResponse {
        prices_cache_size: state.cache.prices.entry_count(),
        config_cache_size: state.cache.config.entry_count(),
        apr_cache_size: state.cache.apr.entry_count(),
        data_cache_size: state.cache.data.entry_count(),
        total_hit_rate: stats.hit_rate,
        prices_hit_rate: stats.prices_hit_rate,
        config_hit_rate: stats.config_hit_rate,
        apr_hit_rate: stats.apr_hit_rate,
        data_hit_rate: stats.data_hit_rate,
        total_hits: stats.total_hits,
        total_misses: stats.total_misses,
    }))
}

/// POST /api/admin/cache/invalidate
/// Invalidate cache entries (admin only)
/// Note: Authentication is handled by the admin_auth_middleware layer
pub async fn invalidate_cache(
    State(state): State<Arc<AppState>>,
    Json(request): Json<InvalidateCacheRequest>,
) -> Result<StatusCode, AppError> {
    match request.cache_type.as_deref() {
        Some("prices") => {
            if let Some(key) = &request.key {
                state.cache.prices.invalidate(key).await;
            } else {
                state.cache.prices.invalidate_all();
            }
        }
        Some("config") => {
            if let Some(key) = &request.key {
                state.cache.config.invalidate(key).await;
            } else {
                state.cache.config.invalidate_all();
            }
        }
        Some("apr") => {
            if let Some(key) = &request.key {
                state.cache.apr.invalidate(key).await;
            } else {
                state.cache.apr.invalidate_all();
            }
        }
        Some("data") => {
            if let Some(key) = &request.key {
                state.cache.data.invalidate(key).await;
            } else {
                state.cache.data.invalidate_all();
            }
        }
        None => {
            // Invalidate all caches
            state.cache.prices.invalidate_all();
            state.cache.config.invalidate_all();
            state.cache.apr.invalidate_all();
            state.cache.data.invalidate_all();
        }
        Some(other) => {
            return Err(AppError::Validation {
                message: format!("Unknown cache type: {}", other),
                field: Some("cache_type".to_string()),
                details: None,
            });
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/intercom/hash
/// Generate Intercom JWT token for identity verification
/// This endpoint matches the beacon's API format for backwards compatibility
pub async fn intercom_hash(
    State(state): State<Arc<AppState>>,
    Json(request): Json<IntercomTokenRequest>,
) -> Result<Json<IntercomTokenResponse>, AppError> {
    let intercom_client = crate::external::intercom::IntercomClient::new(&state.config);
    let result =
        intercom_client.generate_token(&request.wallet, request.wallet_type.as_deref())?;

    Ok(Json(IntercomTokenResponse {
        token: result.token,
    }))
}
