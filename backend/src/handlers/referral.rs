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

use crate::error::AppError;
use crate::external::referral::{
    PayoutStatus, ReferralStatus, RewardStatus,
};
use crate::AppState;

// ============================================================================
// Request/Response Types
// ============================================================================

// --- Validation ---

#[derive(Debug, Serialize)]
pub struct ValidateCodeResponse {
    pub valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referral_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referrer_wallet: Option<String>,
}

// --- Registration ---

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub wallet_address: String,
}

#[derive(Debug, Serialize)]
pub struct RegisterResponse {
    pub wallet_address: String,
    pub referral_code: String,
    pub tier: String,
    pub created_at: String,
    pub already_registered: bool,
}

// --- Stats ---

#[derive(Debug, Serialize)]
pub struct ReferrerResponse {
    pub wallet_address: String,
    pub referral_code: String,
    pub tier: String,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
pub struct ReferrerStatsResponse {
    pub referrer: ReferrerResponse,
    pub stats: StatsResponse,
}

// --- Rewards ---

#[derive(Debug, Deserialize)]
pub struct RewardsQuery {
    pub status: Option<String>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
pub struct RewardsListResponse {
    pub rewards: Vec<RewardResponse>,
    pub total: u64,
    pub limit: u64,
    pub offset: u64,
}

// --- Payouts ---

#[derive(Debug, Deserialize)]
pub struct PayoutsQuery {
    pub status: Option<String>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct PayoutResponse {
    pub id: i64,
    pub total_amount: String,
    pub denom: String,
    pub tx_hash: Option<String>,
    pub status: String,
    pub created_at: String,
    pub executed_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PayoutsListResponse {
    pub payouts: Vec<PayoutResponse>,
    pub total: u64,
    pub limit: u64,
    pub offset: u64,
}

// --- Referrals ---

#[derive(Debug, Deserialize)]
pub struct ReferralsQuery {
    pub status: Option<String>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct ReferralResponse {
    pub id: i64,
    pub referred_wallet: String,
    pub assigned_at: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct ReferralsListResponse {
    pub referrals: Vec<ReferralResponse>,
    pub total: u64,
    pub limit: u64,
    pub offset: u64,
}

// --- Assignment ---

#[derive(Debug, Deserialize)]
pub struct AssignRequest {
    pub referral_code: String,
    pub referred_wallet: String,
}

#[derive(Debug, Serialize)]
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

/// GET /api/referral/validate/:code
/// Validate a referral code (public endpoint)
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

/// POST /api/referral/register
/// Register as a referrer
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

/// GET /api/referral/stats/:address
/// Get referrer statistics
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

/// GET /api/referral/rewards/:address
/// Get referrer rewards
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

/// GET /api/referral/payouts/:address
/// Get referrer payouts
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

/// GET /api/referral/referrals/:address
/// Get referrals made by a referrer
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

/// POST /api/referral/assign
/// Assign a referral (link referred user to referrer)
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

