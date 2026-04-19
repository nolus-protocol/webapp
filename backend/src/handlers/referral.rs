//! Referral Program Handlers
//!
//! Endpoints for the Nolus Referral Program integration.
//!
//! Public endpoints:
//! - GET /api/referral/validate/:code - Validate a referral code
//!
//! Authenticated endpoints:
//! - POST /api/referral/register - Register as a referrer
//! - GET /api/referral/stats/:address - Get referrer statistics
//! - GET /api/referral/rewards/:address - Get referrer rewards
//! - GET /api/referral/payouts/:address - Get referrer payouts
//! - GET /api/referral/referrals/:address - Get referrals made by referrer
//! - POST /api/referral/assign - Assign a referral (link user to referrer)

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::debug;
use utoipa::{IntoParams, ToSchema};

use crate::error::AppError;
use crate::external::referral::{PayoutStatus, ReferralStatus, RewardStatus};
use crate::AppState;

// ============================================================================
// Request/Response Types
// ============================================================================

// --- Validation ---

#[derive(Debug, Serialize, ToSchema)]
pub struct ValidateCodeResponse {
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referral_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referrer_wallet: Option<String>,
}

// --- Registration ---

#[derive(Debug, Deserialize, ToSchema)]
pub struct RegisterRequest {
    pub wallet_address: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RegisterResponse {
    pub wallet_address: String,
    pub referral_code: String,
    pub tier: String,
    pub created_at: String,
    pub already_registered: bool,
}

// --- Stats ---

#[derive(Debug, Serialize, ToSchema)]
pub struct ReferrerResponse {
    pub wallet_address: String,
    pub referral_code: String,
    pub tier: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StatsResponse {
    pub total_referrals: u64,
    pub active_referrals: u64,
    pub total_rewards_earned: String,
    pub total_rewards_paid: String,
    pub pending_rewards: String,
    pub rewards_denom: String,
    pub bonus_rewards_earned: u64,
    pub bonus_rewards_paid: u64,
    pub total_bonus_amount_earned: String,
    pub total_bonus_amount_paid: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ReferrerStatsResponse {
    pub referrer: ReferrerResponse,
    pub stats: StatsResponse,
}

// --- Rewards ---

#[derive(Debug, Deserialize, IntoParams)]
pub struct RewardsQuery {
    /// Optional status filter (`pending`, `included`, `paid`).
    pub status: Option<String>,
    /// Max number of records.
    pub limit: Option<u64>,
    /// Pagination offset.
    pub offset: Option<u64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RewardResponse {
    pub id: i64,
    pub lease_id: String,
    pub referred_wallet: String,
    pub period_start: String,
    pub period_end: String,
    pub interest_collected: String,
    pub interest_denom: String,
    pub reward_amount: String,
    pub reward_denom: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RewardsListResponse {
    pub rewards: Vec<RewardResponse>,
    pub total: u64,
    pub limit: u64,
    pub offset: u64,
}

// --- Payouts ---

#[derive(Debug, Deserialize, IntoParams)]
pub struct PayoutsQuery {
    /// Optional status filter (`pending`, `submitted`, `confirmed`, `failed`).
    pub status: Option<String>,
    /// Max number of records.
    pub limit: Option<u64>,
    /// Pagination offset.
    pub offset: Option<u64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PayoutResponse {
    pub id: i64,
    pub total_amount: String,
    pub denom: String,
    pub tx_hash: Option<String>,
    pub status: String,
    pub created_at: String,
    pub executed_at: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PayoutsListResponse {
    pub payouts: Vec<PayoutResponse>,
    pub total: u64,
    pub limit: u64,
    pub offset: u64,
}

// --- Referrals ---

#[derive(Debug, Deserialize, IntoParams)]
pub struct ReferralsQuery {
    /// Optional status filter (`active`, `inactive`).
    pub status: Option<String>,
    /// Max number of records.
    pub limit: Option<u64>,
    /// Pagination offset.
    pub offset: Option<u64>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ReferralResponse {
    pub id: i64,
    pub referred_wallet: String,
    pub assigned_at: String,
    pub status: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ReferralsListResponse {
    pub referrals: Vec<ReferralResponse>,
    pub total: u64,
    pub limit: u64,
    pub offset: u64,
}

// --- Assignment ---

#[derive(Debug, Deserialize, ToSchema)]
pub struct AssignRequest {
    pub referral_code: String,
    pub referred_wallet: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AssignResponse {
    pub id: i64,
    pub referrer_wallet: String,
    pub referred_wallet: String,
    pub referral_code: String,
    pub assigned_at: String,
}

// ============================================================================
// Helpers
// ============================================================================

fn parse_reward_status(status: &str) -> Option<RewardStatus> {
    match status.to_lowercase().as_str() {
        "pending" => Some(RewardStatus::Pending),
        "included" => Some(RewardStatus::Included),
        "paid" => Some(RewardStatus::Paid),
        _ => None,
    }
}

fn parse_payout_status(status: &str) -> Option<PayoutStatus> {
    match status.to_lowercase().as_str() {
        "pending" => Some(PayoutStatus::Pending),
        "submitted" => Some(PayoutStatus::Submitted),
        "confirmed" => Some(PayoutStatus::Confirmed),
        "failed" => Some(PayoutStatus::Failed),
        _ => None,
    }
}

fn parse_referral_status(status: &str) -> Option<ReferralStatus> {
    match status.to_lowercase().as_str() {
        "active" => Some(ReferralStatus::Active),
        "inactive" => Some(ReferralStatus::Inactive),
        _ => None,
    }
}

// ============================================================================
// Handlers
// ============================================================================

/// Validate a referral code
///
/// Public endpoint — checks whether `code` is a live referral code and returns
/// the owning referrer's wallet if so.
#[utoipa::path(
    get,
    path = "/api/referral/validate/{code}",
    tag = "referral",
    params(
        ("code" = String, Path, description = "Referral code to validate"),
    ),
    responses(
        (status = 200, description = "Validation result", body = ValidateCodeResponse),
        (status = 502, description = "Referral service error or not configured", body = crate::error::ErrorResponse),
    ),
)]
pub async fn validate_code(
    State(state): State<Arc<AppState>>,
    Path(code): Path<String>,
) -> Result<Json<ValidateCodeResponse>, AppError> {
    debug!("Validating referral code: {}", code);

    if !state.referral_client.is_fully_configured() {
        return Err(AppError::ExternalApi {
            api: "Referral".to_string(),
            message: "Referral service not configured".to_string(),
        });
    }

    let result = state.referral_client.validate_code(&code).await?;

    Ok(Json(ValidateCodeResponse {
        valid: result.valid,
        referral_code: result.referral_code,
        referrer_wallet: result.referrer_wallet,
    }))
}

/// Register as a referrer
///
/// Registers the supplied wallet as a referrer and returns its referral code.
/// Responds with `201 Created` for new registrations and `200 OK` when the
/// wallet is already registered (idempotent).
#[utoipa::path(
    post,
    path = "/api/referral/register",
    tag = "referral",
    request_body = RegisterRequest,
    responses(
        (status = 201, description = "Referrer created", body = RegisterResponse),
        (status = 200, description = "Already registered (idempotent)", body = RegisterResponse),
        (status = 502, description = "Referral service error or not configured", body = crate::error::ErrorResponse),
    ),
)]
pub async fn register(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<RegisterResponse>), AppError> {
    debug!("Registering referrer: {}", request.wallet_address);

    if !state.referral_client.is_fully_configured() {
        return Err(AppError::ExternalApi {
            api: "Referral".to_string(),
            message: "Referral service not configured".to_string(),
        });
    }

    let result = state
        .referral_client
        .register_referrer(&request.wallet_address)
        .await?;

    let status = if result.already_registered {
        StatusCode::OK
    } else {
        StatusCode::CREATED
    };

    Ok((
        status,
        Json(RegisterResponse {
            wallet_address: result.wallet_address,
            referral_code: result.referral_code,
            tier: format!("{:?}", result.tier).to_lowercase(),
            created_at: result.created_at,
            already_registered: result.already_registered,
        }),
    ))
}

/// Get referrer statistics
///
/// Returns aggregated stats (totals, pending rewards, bonuses) for the
/// referrer identified by `address`.
#[utoipa::path(
    get,
    path = "/api/referral/stats/{address}",
    tag = "referral",
    params(
        ("address" = String, Path, description = "Referrer wallet address"),
    ),
    responses(
        (status = 200, description = "Referrer stats", body = ReferrerStatsResponse),
        (status = 404, description = "Referrer not found", body = crate::error::ErrorResponse),
        (status = 502, description = "Referral service error or not configured", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_stats(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<Json<ReferrerStatsResponse>, AppError> {
    debug!("Getting referral stats for: {}", address);

    if !state.referral_client.is_fully_configured() {
        return Err(AppError::ExternalApi {
            api: "Referral".to_string(),
            message: "Referral service not configured".to_string(),
        });
    }

    let result = state.referral_client.get_referrer_stats(&address).await?;

    Ok(Json(ReferrerStatsResponse {
        referrer: ReferrerResponse {
            wallet_address: result.referrer.wallet_address,
            referral_code: result.referrer.referral_code,
            tier: format!("{:?}", result.referrer.tier).to_lowercase(),
            status: format!("{:?}", result.referrer.status).to_lowercase(),
            created_at: result.referrer.created_at,
        },
        stats: StatsResponse {
            total_referrals: result.stats.total_referrals,
            active_referrals: result.stats.active_referrals,
            total_rewards_earned: result.stats.total_rewards_earned,
            total_rewards_paid: result.stats.total_rewards_paid,
            pending_rewards: result.stats.pending_rewards,
            rewards_denom: result.stats.rewards_denom,
            bonus_rewards_earned: result.stats.bonus_rewards_earned,
            bonus_rewards_paid: result.stats.bonus_rewards_paid,
            total_bonus_amount_earned: result.stats.total_bonus_amount_earned,
            total_bonus_amount_paid: result.stats.total_bonus_amount_paid,
        },
    }))
}

/// Get referrer rewards
///
/// Returns paginated rewards earned by the referrer, with optional status filter.
#[utoipa::path(
    get,
    path = "/api/referral/rewards/{address}",
    tag = "referral",
    params(
        ("address" = String, Path, description = "Referrer wallet address"),
        RewardsQuery,
    ),
    responses(
        (status = 200, description = "Paginated rewards", body = RewardsListResponse),
        (status = 502, description = "Referral service error or not configured", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_rewards(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
    Query(query): Query<RewardsQuery>,
) -> Result<Json<RewardsListResponse>, AppError> {
    debug!("Getting referral rewards for: {}", address);

    if !state.referral_client.is_fully_configured() {
        return Err(AppError::ExternalApi {
            api: "Referral".to_string(),
            message: "Referral service not configured".to_string(),
        });
    }

    let api_query = crate::external::referral::RewardsQuery {
        status: query.status.as_ref().and_then(|s| parse_reward_status(s)),
        limit: query.limit,
        offset: query.offset,
    };

    let result = state
        .referral_client
        .get_referrer_rewards(&address, api_query)
        .await?;

    Ok(Json(RewardsListResponse {
        rewards: result
            .rewards
            .into_iter()
            .map(|r| RewardResponse {
                id: r.id,
                lease_id: r.lease_id,
                referred_wallet: r.referred_wallet,
                period_start: r.period_start,
                period_end: r.period_end,
                interest_collected: r.interest_collected,
                interest_denom: r.interest_denom,
                reward_amount: r.reward_amount,
                reward_denom: r.reward_denom,
                status: format!("{:?}", r.status).to_lowercase(),
                created_at: r.created_at,
            })
            .collect(),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
    }))
}

/// Get referrer payouts
///
/// Returns paginated payouts for the referrer, with optional status filter.
#[utoipa::path(
    get,
    path = "/api/referral/payouts/{address}",
    tag = "referral",
    params(
        ("address" = String, Path, description = "Referrer wallet address"),
        PayoutsQuery,
    ),
    responses(
        (status = 200, description = "Paginated payouts", body = PayoutsListResponse),
        (status = 502, description = "Referral service error or not configured", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_payouts(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
    Query(query): Query<PayoutsQuery>,
) -> Result<Json<PayoutsListResponse>, AppError> {
    debug!("Getting referral payouts for: {}", address);

    if !state.referral_client.is_fully_configured() {
        return Err(AppError::ExternalApi {
            api: "Referral".to_string(),
            message: "Referral service not configured".to_string(),
        });
    }

    let api_query = crate::external::referral::PayoutsQuery {
        status: query.status.as_ref().and_then(|s| parse_payout_status(s)),
        limit: query.limit,
        offset: query.offset,
    };

    let result = state
        .referral_client
        .get_referrer_payouts(&address, api_query)
        .await?;

    Ok(Json(PayoutsListResponse {
        payouts: result
            .payouts
            .into_iter()
            .map(|p| PayoutResponse {
                id: p.id,
                total_amount: p.total_amount,
                denom: p.denom,
                tx_hash: p.tx_hash,
                status: format!("{:?}", p.status).to_lowercase(),
                created_at: p.created_at,
                executed_at: p.executed_at,
            })
            .collect(),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
    }))
}

/// Get referrals for a referrer
///
/// Returns paginated referrals (referred wallets) attached to this referrer.
#[utoipa::path(
    get,
    path = "/api/referral/referrals/{address}",
    tag = "referral",
    params(
        ("address" = String, Path, description = "Referrer wallet address"),
        ReferralsQuery,
    ),
    responses(
        (status = 200, description = "Paginated referrals", body = ReferralsListResponse),
        (status = 502, description = "Referral service error or not configured", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_referrals(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
    Query(query): Query<ReferralsQuery>,
) -> Result<Json<ReferralsListResponse>, AppError> {
    debug!("Getting referrals for referrer: {}", address);

    if !state.referral_client.is_fully_configured() {
        return Err(AppError::ExternalApi {
            api: "Referral".to_string(),
            message: "Referral service not configured".to_string(),
        });
    }

    let api_query = crate::external::referral::ReferralsQuery {
        status: query.status.as_ref().and_then(|s| parse_referral_status(s)),
        limit: query.limit,
        offset: query.offset,
    };

    let result = state
        .referral_client
        .get_referrals(&address, api_query)
        .await?;

    Ok(Json(ReferralsListResponse {
        referrals: result
            .referrals
            .into_iter()
            .map(|r| ReferralResponse {
                id: r.id,
                referred_wallet: r.referred_wallet,
                assigned_at: r.assigned_at,
                status: format!("{:?}", r.status).to_lowercase(),
            })
            .collect(),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
    }))
}

/// Assign a referral
///
/// Links `referred_wallet` to the referrer that owns `referral_code`. Fails if
/// the wallet already has a referrer, the code is unknown, or the wallet is
/// trying to self-refer.
#[utoipa::path(
    post,
    path = "/api/referral/assign",
    tag = "referral",
    request_body = AssignRequest,
    responses(
        (status = 201, description = "Referral assigned", body = AssignResponse),
        (status = 404, description = "Referral code not found", body = crate::error::ErrorResponse),
        (status = 502, description = "Referral service error or not configured (including already-assigned / self-referral conflicts)", body = crate::error::ErrorResponse),
    ),
)]
pub async fn assign(
    State(state): State<Arc<AppState>>,
    Json(request): Json<AssignRequest>,
) -> Result<(StatusCode, Json<AssignResponse>), AppError> {
    debug!(
        "Assigning referral: code={} wallet={}",
        request.referral_code, request.referred_wallet
    );

    if !state.referral_client.is_fully_configured() {
        return Err(AppError::ExternalApi {
            api: "Referral".to_string(),
            message: "Referral service not configured".to_string(),
        });
    }

    let result = state
        .referral_client
        .assign_referral(&request.referral_code, &request.referred_wallet)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(AssignResponse {
            id: result.id,
            referrer_wallet: result.referrer_wallet,
            referred_wallet: result.referred_wallet,
            referral_code: result.referral_code,
            assigned_at: result.assigned_at,
        }),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{collect_body_str, test_app_state, test_app_state_with_config};
    use crate::{
        config::{AdminConfig, AppConfig, ExternalApiConfig, ProtocolsConfig, ServerConfig},
        test_utils::test_config,
    };
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        routing::{get, post},
        Router,
    };
    use tower::ServiceExt;

    fn build_app(state: Arc<AppState>) -> Router {
        Router::new()
            .route("/api/referral/validate/{code}", get(validate_code))
            .route("/api/referral/referrals/{address}", get(get_referrals))
            .route("/api/referral/assign", post(assign))
            .with_state(state)
    }

    fn config_unconfigured() -> AppConfig {
        // Blank out referral token so is_fully_configured() returns false.
        AppConfig {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 0,
                cors_origins: None,
            },
            external: ExternalApiConfig {
                etl_api_url: "http://127.0.0.1:1/".to_string(),
                skip_api_url: "http://127.0.0.1:1/".to_string(),
                skip_api_key: None,
                nolus_rpc_url: "http://127.0.0.1:1/".to_string(),
                nolus_rest_url: "http://127.0.0.1:1/".to_string(),
                referral_api_url: "http://127.0.0.1:1/".to_string(),
                referral_api_token: "".to_string(),
                zero_interest_api_url: "http://127.0.0.1:1/".to_string(),
                zero_interest_api_token: "stub".to_string(),
                intercom_app_id: "stub".to_string(),
                intercom_secret_key: "stub".to_string(),
            },
            admin: AdminConfig {
                enabled: false,
                api_key: String::new(),
            },
            protocols: ProtocolsConfig::default(),
        }
    }

    #[tokio::test]
    async fn referral_validate_when_service_not_configured_returns_502() {
        let state = test_app_state_with_config(config_unconfigured()).await;
        let app = build_app(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/referral/validate/SOMECODE")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
        let body = collect_body_str(resp).await;
        assert!(
            body.contains("not configured"),
            "expected unconfigured message, got: {body}"
        );
    }

    #[tokio::test]
    async fn referral_referrals_upstream_failure_returns_502() {
        // stub referral URL (127.0.0.1:1 + 1ms timeout) fails → 502
        let _ = test_config(); // touch helper to confirm import path
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/referral/referrals/nolus1xyz")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
    }

    #[tokio::test]
    async fn referral_assign_malformed_body_returns_400() {
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/referral/assign")
                    .header("content-type", "application/json")
                    .body(Body::from("{ not json".to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }
}
