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

/// Cache stats response for the new background-refresh model.
/// Each field shows whether it's populated and how stale it is.
#[derive(Debug, Serialize, Deserialize)]
pub struct CacheStatsResponse {
    pub fields: Vec<CacheFieldInfo>,
    pub populated_count: usize,
    pub total_count: usize,
}

/// Info about a single cache field
#[derive(Debug, Serialize, Deserialize)]
pub struct CacheFieldInfo {
    pub name: String,
    pub populated: bool,
    pub age_secs: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct InvalidateCacheRequest {
    pub cache_type: Option<String>,
}

/// Request for Intercom JWT token generation
/// Only wallet address and type are needed — all portfolio data is fetched server-side
#[derive(Debug, Serialize, Deserialize)]
pub struct IntercomTokenRequest {
    pub wallet: String,
    pub wallet_type: String,
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
    let (
        etl_status,
        nolus_rpc_status,
        nolus_rest_status,
        skip_status,
        referral_status,
        zero_interest_status,
    ) = tokio::join!(
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

    // Cache health — count populated fields from data_cache
    let summary = state.data_cache.status_summary();
    let all_fields = [
        &summary.app_config,
        &summary.protocol_contracts,
        &summary.currencies,
        &summary.prices,
        &summary.gated_config,
        &summary.filter_context,
        &summary.pools,
        &summary.validators,
        &summary.gated_assets,
        &summary.gated_protocols,
        &summary.gated_networks,
        &summary.stats_overview,
        &summary.loans_stats,
        &summary.swap_config,
        &summary.lease_configs,
    ];
    let populated_count = all_fields.iter().filter(|f| f.populated).count();
    let total_count = all_fields.len();

    let cache_status = if populated_count == total_count {
        "healthy"
    } else if populated_count > 0 {
        "warming"
    } else {
        "empty"
    };

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
            total_entries: populated_count as u64,
            hit_rate: if total_count > 0 {
                populated_count as f64 / total_count as f64
            } else {
                0.0
            },
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
    match timeout(
        timeout_duration,
        state.etl_client.client.get(&check_url).send(),
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
/// Returns population status and age of each background-refreshed cache field.
/// Note: Authentication is handled by the admin_auth_middleware layer
pub async fn get_cache_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<CacheStatsResponse>, AppError> {
    let summary = state.data_cache.status_summary();

    let fields: Vec<CacheFieldInfo> = vec![
        summary.app_config,
        summary.protocol_contracts,
        summary.currencies,
        summary.prices,
        summary.gated_config,
        summary.filter_context,
        summary.pools,
        summary.validators,
        summary.gated_assets,
        summary.gated_protocols,
        summary.gated_networks,
        summary.stats_overview,
        summary.loans_stats,
        summary.swap_config,
        summary.lease_configs,
    ]
    .into_iter()
    .map(|f| CacheFieldInfo {
        name: f.name,
        populated: f.populated,
        age_secs: f.age_secs,
    })
    .collect();

    let populated_count = fields.iter().filter(|f| f.populated).count();
    let total_count = fields.len();

    Ok(Json(CacheStatsResponse {
        fields,
        populated_count,
        total_count,
    }))
}

/// POST /api/admin/cache/invalidate
/// Trigger immediate refresh of cache entries (admin only)
/// In the background-refresh model, "invalidation" means triggering an immediate
/// re-fetch by the background task. The cache field name maps to a refresh function.
/// Note: Authentication is handled by the admin_auth_middleware layer
pub async fn invalidate_cache(
    State(state): State<Arc<AppState>>,
    Json(request): Json<InvalidateCacheRequest>,
) -> Result<StatusCode, AppError> {
    // In the new model, we trigger immediate refresh of the specified cache
    // by spawning refresh tasks directly

    match request.cache_type.as_deref() {
        Some(cache_name) => {
            // Spawn a refresh for the specified cache field
            let s = state.clone();
            match cache_name {
                "gated_config" => {
                    tokio::spawn(async move { crate::refresh::refresh_gated_config(&s).await });
                }
                "filter_context" => {
                    tokio::spawn(async move { crate::refresh::refresh_filter_context(&s).await });
                }
                "app_config" => {
                    tokio::spawn(async move { crate::refresh::refresh_app_config(&s).await });
                }
                "protocol_contracts" => {
                    tokio::spawn(
                        async move { crate::refresh::refresh_protocol_contracts(&s).await },
                    );
                }
                "currencies" => {
                    tokio::spawn(async move { crate::refresh::refresh_currencies(&s).await });
                }
                "prices" => {
                    tokio::spawn(async move { crate::refresh::refresh_prices(&s).await });
                }
                "pools" => {
                    tokio::spawn(async move { crate::refresh::refresh_pools(&s).await });
                }
                "validators" => {
                    tokio::spawn(async move { crate::refresh::refresh_validators(&s).await });
                }
                "gated_assets" => {
                    tokio::spawn(async move { crate::refresh::refresh_gated_assets(&s).await });
                }
                "gated_protocols" => {
                    tokio::spawn(async move { crate::refresh::refresh_gated_protocols(&s).await });
                }
                "gated_networks" => {
                    tokio::spawn(async move { crate::refresh::refresh_gated_networks(&s).await });
                }
                "stats_overview" => {
                    tokio::spawn(async move { crate::refresh::refresh_stats_overview(&s).await });
                }
                "loans_stats" => {
                    tokio::spawn(async move { crate::refresh::refresh_loans_stats(&s).await });
                }
                "swap_config" => {
                    tokio::spawn(async move { crate::refresh::refresh_swap_config(&s).await });
                }
                "lease_configs" => {
                    tokio::spawn(async move { crate::refresh::refresh_lease_configs(&s).await });
                }
                "annual_inflation" => {
                    tokio::spawn(async move { crate::refresh::refresh_annual_inflation(&s).await });
                }
                "staking_pool" => {
                    tokio::spawn(async move { crate::refresh::refresh_staking_pool(&s).await });
                }
                other => {
                    return Err(AppError::Validation {
                        message: format!("Unknown cache field: {}", other),
                        field: Some("cache_type".to_string()),
                        details: None,
                    });
                }
            }
        }
        None => {
            // Refresh all caches
            let s = state.clone();
            tokio::spawn(async move {
                crate::refresh::warm_essential_data(s).await;
            });
        }
    }

    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/intercom/hash
/// Generate Intercom JWT token with all portfolio data computed server-side.
/// The frontend only sends wallet address and type — everything else is fetched here.
pub async fn intercom_hash(
    State(state): State<Arc<AppState>>,
    Json(request): Json<IntercomTokenRequest>,
) -> Result<Json<IntercomTokenResponse>, AppError> {
    crate::validation::validate_bech32_address(&request.wallet, "wallet")?;

    let intercom_client = crate::external::intercom::IntercomClient::new(&state.config);

    // Fetch all portfolio data in parallel
    let wallet = &request.wallet;
    let (balances_result, leases_result, earn_result, delegations_result, account_result) = tokio::join!(
        compute_total_balance_usd(&state, wallet),
        crate::handlers::leases::fetch_leases_for_monitoring(&state, wallet),
        crate::handlers::earn::fetch_earn_positions_for_monitoring(&state, wallet),
        state.chain_client.get_delegations(wallet),
        state.chain_client.get_account(wallet),
    );

    // Balance
    let total_balance_usd = balances_result.unwrap_or_else(|e| {
        warn!("[Intercom] Failed to compute balance for {}: {}", wallet, e);
        "0.00".to_string()
    });

    // Leases
    let leases = leases_result.unwrap_or_else(|e| {
        warn!("[Intercom] Failed to fetch leases for {}: {}", wallet, e);
        Vec::new()
    });
    let opened_leases: Vec<_> = leases.iter().filter(|l| l.status == "opened").collect();
    let positions_count = opened_leases.len() as u32;

    // Earn
    let (earn_positions, _) = earn_result.unwrap_or_else(|e| {
        warn!("[Intercom] Failed to fetch earn for {}: {}", wallet, e);
        (Vec::new(), "0.00".to_string())
    });
    let earn_pools_count = earn_positions.len() as u32;
    let earn_deposited_usd = compute_earn_deposited_usd(&earn_positions, &state);

    // Staking
    let delegations = delegations_result.unwrap_or_else(|e| {
        warn!(
            "[Intercom] Failed to fetch delegations for {}: {}",
            wallet, e
        );
        Vec::new()
    });
    let staking_validators_count = delegations.len() as u32;
    let total_staked_unls: u128 = delegations
        .iter()
        .filter_map(|d| d.balance.amount.parse::<u128>().ok())
        .sum();
    let staking_delegated_nls = format!("{:.6}", total_staked_unls as f64 / 1_000_000.0);
    let nls_price = compute_nls_price_usd(&state);
    let staking_delegated_usd =
        format!("{:.2}", total_staked_unls as f64 / 1_000_000.0 * nls_price);

    // Vesting
    let (staking_vested_nls, is_vesting_account) = match account_result {
        Ok(account_resp) => extract_vesting(&account_resp.account),
        Err(e) => {
            warn!("[Intercom] Failed to fetch account for {}: {}", wallet, e);
            ("0.000000".to_string(), false)
        }
    };

    let attributes = crate::external::intercom::IntercomAttributes {
        wallet_type: request.wallet_type,
        total_balance_usd,
        positions_count,
        positions_value_usd: "0.00".to_string(),
        positions_debt_usd: "0.00".to_string(),
        positions_unrealized_pnl_usd: "0.00".to_string(),
        earn_deposited_usd,
        earn_pools_count,
        staking_delegated_nls,
        staking_delegated_usd,
        staking_vested_nls,
        staking_validators_count,
        has_active_leases: positions_count > 0,
        has_earn_positions: earn_pools_count > 0,
        has_staking_positions: staking_validators_count > 0,
        is_vesting_account,
        positions_dashboard_url: format!(
            "https://crtl.kostovster.io/chain-data/wallet-explorer?address={}",
            wallet
        ),
    };

    let result = intercom_client.generate_token(wallet, &attributes)?;

    Ok(Json(IntercomTokenResponse {
        token: result.token,
    }))
}

/// Compute total USD value of all bank balances for an address.
/// Pattern from currencies.rs get_balances handler.
async fn compute_total_balance_usd(state: &AppState, address: &str) -> Result<String, AppError> {
    let filter_ctx = state
        .data_cache
        .filter_context
        .load_or_unavailable("Filter context")?;
    let currencies_response = state
        .data_cache
        .currencies
        .load_or_unavailable("Currencies")?;
    let prices_response = state.data_cache.prices.load_or_unavailable("Prices")?;
    let bank_balances = state.chain_client.get_all_balances(address).await?;

    let mut total_usd = 0.0_f64;
    for bank_balance in bank_balances {
        let currency = currencies_response
            .currencies
            .values()
            .find(|c| c.bank_symbol == bank_balance.denom);

        if let Some(currency) = currency {
            if !filter_ctx.is_balance_visible(&currency.ticker) {
                continue;
            }
            let amount_f64: f64 = bank_balance.amount.parse().unwrap_or(0.0);
            let decimal_factor = 10_f64.powi(currency.decimal_digits as i32);
            let human_amount = amount_f64 / decimal_factor;
            let price_usd = prices_response
                .prices
                .get(&currency.key)
                .and_then(|p| p.price_usd.parse::<f64>().ok())
                .unwrap_or(0.0);
            total_usd += human_amount * price_usd;
        }
    }

    Ok(format!("{:.2}", total_usd))
}

/// Look up NLS price in USD from the cached prices.
fn compute_nls_price_usd(state: &AppState) -> f64 {
    let currencies = match state.data_cache.currencies.load() {
        Some(c) => c,
        None => return 0.0,
    };
    let prices = match state.data_cache.prices.load() {
        Some(p) => p,
        None => return 0.0,
    };

    // Find NLS currency by bank_symbol "unls"
    let nls_currency = currencies
        .currencies
        .values()
        .find(|c| c.bank_symbol == "unls");
    match nls_currency {
        Some(currency) => prices
            .prices
            .get(&currency.key)
            .and_then(|p| p.price_usd.parse::<f64>().ok())
            .unwrap_or(0.0),
        None => 0.0,
    }
}

/// Compute total USD value of earn deposits.
/// Each position has deposited_lpn in base units of the protocol's LPN currency.
fn compute_earn_deposited_usd(
    positions: &[crate::handlers::websocket::EarnPositionInfo],
    state: &AppState,
) -> String {
    let currencies = match state.data_cache.currencies.load() {
        Some(c) => c,
        None => return "0.00".to_string(),
    };
    let prices = match state.data_cache.prices.load() {
        Some(p) => p,
        None => return "0.00".to_string(),
    };

    let mut total_usd = 0.0_f64;
    for position in positions {
        // Find the LPN currency for this protocol from the lpn list
        let lpn_currency = currencies
            .lpn
            .iter()
            .find(|c| c.key.ends_with(&format!("@{}", position.protocol)));

        if let Some(lpn) = lpn_currency {
            let deposited: f64 = position.deposited_lpn.parse().unwrap_or(0.0);
            let decimal_factor = 10_f64.powi(lpn.decimal_digits as i32);
            let human_amount = deposited / decimal_factor;
            let price_usd = prices
                .prices
                .get(&lpn.key)
                .and_then(|p| p.price_usd.parse::<f64>().ok())
                .unwrap_or(0.0);
            total_usd += human_amount * price_usd;
        }
    }

    format!("{:.2}", total_usd)
}

/// Extract vesting info from account response JSON.
/// Returns (vested_nls_human, is_vesting_account).
fn extract_vesting(account: &serde_json::Value) -> (String, bool) {
    let vesting = account.get("base_vesting_account");
    match vesting {
        Some(v) => {
            let amount = v
                .pointer("/original_vesting/0/amount")
                .and_then(|a| a.as_str())
                .and_then(|a| a.parse::<u128>().ok())
                .unwrap_or(0);
            let human_nls = amount as f64 / 1_000_000.0;
            (format!("{:.6}", human_nls), true)
        }
        None => ("0.000000".to_string(), false),
    }
}
