//! Staking handlers for validator delegation and rewards
//!
//! Endpoints:
//! - GET /api/staking/validators - Get all validators
//! - GET /api/staking/validators/:address - Get specific validator
//! - GET /api/staking/positions?delegator=... - Get staking positions
//! - GET /api/staking/params - Get staking parameters
//! - POST /api/staking/delegate - Build delegate transaction
//! - POST /api/staking/undelegate - Build undelegate transaction
//! - POST /api/staking/redelegate - Build redelegate transaction
//! - POST /api/staking/claim-rewards - Build claim rewards transaction

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, warn};
use utoipa::ToSchema;

use crate::error::AppError;
use crate::query_types::AddressQuery;
use crate::AppState;

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Validator {
    pub operator_address: String,
    pub moniker: String,
    pub identity: Option<String>,
    pub website: Option<String>,
    pub details: Option<String>,
    pub commission_rate: String,
    pub max_commission_rate: String,
    pub max_commission_change_rate: String,
    pub tokens: String,
    pub delegator_shares: String,
    pub unbonding_height: String,
    pub unbonding_time: String,
    pub status: ValidatorStatus,
    pub jailed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ValidatorStatus {
    Bonded,
    Unbonding,
    Unbonded,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct StakingPosition {
    pub validator_address: String,
    pub validator_moniker: Option<String>,
    pub shares: String,
    pub balance: BalanceInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(as = staking::BalanceInfo)]
pub struct BalanceInfo {
    pub denom: String,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UnbondingPosition {
    pub validator_address: String,
    pub validator_moniker: Option<String>,
    pub entries: Vec<UnbondingEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UnbondingEntry {
    pub creation_height: String,
    pub completion_time: String,
    pub initial_balance: String,
    pub balance: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct StakingPositionsResponse {
    pub delegations: Vec<StakingPosition>,
    pub unbonding: Vec<UnbondingPosition>,
    pub rewards: Vec<ValidatorReward>,
    pub total_staked: String,
    pub total_rewards: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ValidatorReward {
    pub validator_address: String,
    pub rewards: Vec<BalanceInfo>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct DelegateRequest {
    pub validator_address: String,
    pub amount: String,
    pub denom: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UndelegateRequest {
    pub validator_address: String,
    pub amount: String,
    pub denom: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct RedelegateRequest {
    pub src_validator_address: String,
    pub dst_validator_address: String,
    pub amount: String,
    pub denom: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ClaimRewardsRequest {
    pub validator_addresses: Vec<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct StakingTransactionResponse {
    /// Unsigned Cosmos SDK messages for client-side signing
    #[schema(value_type = Vec<Object>)]
    pub messages: Vec<serde_json::Value>,
    pub memo: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct StakingParams {
    pub unbonding_time: String,
    pub max_validators: u32,
    pub max_entries: u32,
    pub bond_denom: String,
    pub min_commission_rate: String,
}

// ============================================================================
// Handlers
// ============================================================================

/// List all validators
///
/// Returns the validator set (bonded and non-bonded), served from a
/// background-refreshed cache for zero latency.
#[utoipa::path(
    get,
    path = "/api/staking/validators",
    tag = "staking",
    responses(
        (status = 200, description = "List of validators", body = Vec<Validator>),
        (status = 503, description = "Cache not yet populated", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_validators(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Validator>>, AppError> {
    let validators = state
        .data_cache
        .validators
        .load_or_unavailable("Validators")?;

    Ok(Json(validators))
}

/// Get a single validator
///
/// Looks up a validator by its operator address (`nolusvaloper1...`).
#[utoipa::path(
    get,
    path = "/api/staking/validators/{address}",
    tag = "staking",
    params(
        ("address" = String, Path, description = "Validator operator address (`nolusvaloper1...`)"),
    ),
    responses(
        (status = 200, description = "Validator details", body = Validator),
        (status = 404, description = "Validator not found", body = crate::error::ErrorResponse),
        (status = 503, description = "Cache not yet populated", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_validator(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<Json<Validator>, AppError> {
    debug!("Getting validator: {}", address);

    // Get validator from cache
    let validators = state
        .data_cache
        .validators
        .load_or_unavailable("Validators")?;

    let validator = validators
        .into_iter()
        .find(|v| v.operator_address == address)
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Validator {}", address),
        })?;

    Ok(Json(validator))
}

/// Get staking positions for a delegator
///
/// Returns all delegations, unbonding entries, and pending rewards for a
/// delegator address, with aggregated totals.
#[utoipa::path(
    get,
    path = "/api/staking/positions",
    tag = "staking",
    params(AddressQuery),
    responses(
        (status = 200, description = "Staking positions", body = StakingPositionsResponse),
        (status = 400, description = "Invalid address", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_positions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<AddressQuery>,
) -> Result<Json<StakingPositionsResponse>, AppError> {
    crate::validation::validate_bech32_address(&query.address, "address")?;
    debug!("Getting staking positions for: {}", query.address);

    // Fetch user-specific data in parallel; validators come from cache
    debug!("Fetching delegations, rewards, and unbonding...");
    let (delegations_result, rewards_result, unbonding_result) = tokio::join!(
        state.chain_client.get_delegations(&query.address),
        state.chain_client.get_rewards(&query.address),
        state.chain_client.get_unbonding_delegations(&query.address),
    );
    debug!("Delegations result: {:?}", delegations_result.is_ok());
    debug!("Rewards result: {:?}", rewards_result.is_ok());
    debug!("Unbonding result: {:?}", unbonding_result.is_ok());

    let delegations = delegations_result.unwrap_or_default();
    let rewards_response = match rewards_result {
        Ok(r) => Some(r),
        Err(e) => {
            warn!("Failed to fetch staking rewards: {}", e);
            None
        }
    };
    let unbonding_delegations = unbonding_result.unwrap_or_default();
    let validators = state.data_cache.validators.load();

    // Build delegations list
    let delegation_positions: Vec<StakingPosition> = delegations
        .iter()
        .map(|d| {
            let moniker = validators.as_ref().and_then(|vs| {
                vs.iter()
                    .find(|v| v.operator_address == d.delegation.validator_address)
                    .map(|v| v.moniker.clone())
            });

            StakingPosition {
                validator_address: d.delegation.validator_address.clone(),
                validator_moniker: moniker,
                shares: d.delegation.shares.clone(),
                balance: BalanceInfo {
                    denom: d.balance.denom.clone(),
                    amount: d.balance.amount.clone(),
                },
            }
        })
        .collect();

    // Calculate total staked
    let total_staked: u128 = delegations
        .iter()
        .filter_map(|d| d.balance.amount.parse::<u128>().ok())
        .sum();

    // Build rewards list
    let rewards: Vec<ValidatorReward> = rewards_response
        .as_ref()
        .map(|r| {
            r.rewards
                .iter()
                .map(|vr| ValidatorReward {
                    validator_address: vr.validator_address.clone(),
                    rewards: vr
                        .reward
                        .iter()
                        .map(|b| BalanceInfo {
                            denom: b.denom.clone(),
                            amount: b.amount.clone(),
                        })
                        .collect(),
                })
                .collect()
        })
        .unwrap_or_default();

    // Calculate total rewards
    // Chain returns decimal strings like "1234567.890000000000000000"
    // Extract integer part to avoid f64 precision issues
    let total_rewards: u128 = rewards_response
        .as_ref()
        .map(|r| {
            r.total
                .iter()
                .filter_map(|b| {
                    let integer_part = b.amount.split('.').next().unwrap_or("0");
                    integer_part.parse::<u128>().ok()
                })
                .sum()
        })
        .unwrap_or(0);

    // Build unbonding positions
    let unbonding_positions: Vec<UnbondingPosition> = unbonding_delegations
        .iter()
        .map(|u| {
            let moniker = validators.as_ref().and_then(|vs| {
                vs.iter()
                    .find(|v| v.operator_address == u.validator_address)
                    .map(|v| v.moniker.clone())
            });

            UnbondingPosition {
                validator_address: u.validator_address.clone(),
                validator_moniker: moniker,
                entries: u
                    .entries
                    .iter()
                    .map(|e| self::UnbondingEntry {
                        creation_height: e.creation_height.clone(),
                        completion_time: e.completion_time.clone(),
                        initial_balance: e.initial_balance.clone(),
                        balance: e.balance.clone(),
                    })
                    .collect(),
            }
        })
        .collect();

    Ok(Json(StakingPositionsResponse {
        delegations: delegation_positions,
        unbonding: unbonding_positions,
        rewards,
        total_staked: total_staked.to_string(),
        total_rewards: total_rewards.to_string(),
    }))
}

/// Get staking parameters
///
/// Returns the chain's staking module parameters (unbonding time, max
/// validators, bond denom, etc.).
#[utoipa::path(
    get,
    path = "/api/staking/params",
    tag = "staking",
    responses(
        (status = 200, description = "Staking parameters", body = StakingParams),
    ),
)]
pub async fn get_staking_params(
    State(state): State<Arc<AppState>>,
) -> Result<Json<StakingParams>, AppError> {
    debug!("Getting staking params");

    let result = state.chain_client.get_staking_params().await?;

    Ok(Json(StakingParams {
        unbonding_time: result.params.unbonding_time,
        max_validators: result.params.max_validators,
        max_entries: result.params.max_entries,
        bond_denom: result.params.bond_denom,
        min_commission_rate: result.params.min_commission_rate,
    }))
}

/// Build a delegate transaction
///
/// Returns an unsigned `MsgDelegate` for client-side signing. The delegator
/// address is filled in by the frontend before broadcast.
#[utoipa::path(
    post,
    path = "/api/staking/delegate",
    tag = "staking",
    request_body = DelegateRequest,
    responses(
        (status = 200, description = "Unsigned delegate transaction", body = StakingTransactionResponse),
    ),
)]
pub async fn delegate(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<DelegateRequest>,
) -> Result<Json<StakingTransactionResponse>, AppError> {
    debug!(
        "Building delegate transaction to validator: {}",
        request.validator_address
    );

    let delegate_msg = serde_json::json!({
        "@type": "/cosmos.staking.v1beta1.MsgDelegate",
        "delegator_address": "", // Will be filled by frontend
        "validator_address": request.validator_address,
        "amount": {
            "denom": request.denom,
            "amount": request.amount
        }
    });

    Ok(Json(StakingTransactionResponse {
        messages: vec![delegate_msg],
        memo: "Delegate to Nolus validator".to_string(),
    }))
}

/// Build an undelegate transaction
///
/// Returns an unsigned `MsgUndelegate` for client-side signing.
#[utoipa::path(
    post,
    path = "/api/staking/undelegate",
    tag = "staking",
    request_body = UndelegateRequest,
    responses(
        (status = 200, description = "Unsigned undelegate transaction", body = StakingTransactionResponse),
    ),
)]
pub async fn undelegate(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<UndelegateRequest>,
) -> Result<Json<StakingTransactionResponse>, AppError> {
    debug!(
        "Building undelegate transaction from validator: {}",
        request.validator_address
    );

    let undelegate_msg = serde_json::json!({
        "@type": "/cosmos.staking.v1beta1.MsgUndelegate",
        "delegator_address": "", // Will be filled by frontend
        "validator_address": request.validator_address,
        "amount": {
            "denom": request.denom,
            "amount": request.amount
        }
    });

    Ok(Json(StakingTransactionResponse {
        messages: vec![undelegate_msg],
        memo: "Undelegate from Nolus validator".to_string(),
    }))
}

/// Build a redelegate transaction
///
/// Returns an unsigned `MsgBeginRedelegate` for moving stake between validators.
#[utoipa::path(
    post,
    path = "/api/staking/redelegate",
    tag = "staking",
    request_body = RedelegateRequest,
    responses(
        (status = 200, description = "Unsigned redelegate transaction", body = StakingTransactionResponse),
    ),
)]
pub async fn redelegate(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<RedelegateRequest>,
) -> Result<Json<StakingTransactionResponse>, AppError> {
    debug!(
        "Building redelegate transaction from {} to {}",
        request.src_validator_address, request.dst_validator_address
    );

    let redelegate_msg = serde_json::json!({
        "@type": "/cosmos.staking.v1beta1.MsgBeginRedelegate",
        "delegator_address": "", // Will be filled by frontend
        "validator_src_address": request.src_validator_address,
        "validator_dst_address": request.dst_validator_address,
        "amount": {
            "denom": request.denom,
            "amount": request.amount
        }
    });

    Ok(Json(StakingTransactionResponse {
        messages: vec![redelegate_msg],
        memo: "Redelegate on Nolus".to_string(),
    }))
}

/// Build a claim-rewards transaction
///
/// Returns unsigned `MsgWithdrawDelegatorReward` messages, one per validator
/// address supplied.
#[utoipa::path(
    post,
    path = "/api/staking/claim-rewards",
    tag = "staking",
    request_body = ClaimRewardsRequest,
    responses(
        (status = 200, description = "Unsigned claim-rewards transaction", body = StakingTransactionResponse),
    ),
)]
pub async fn claim_rewards(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<ClaimRewardsRequest>,
) -> Result<Json<StakingTransactionResponse>, AppError> {
    debug!(
        "Building claim rewards transaction for {} validators",
        request.validator_addresses.len()
    );

    let messages: Vec<serde_json::Value> = request
        .validator_addresses
        .iter()
        .map(|validator_address| {
            serde_json::json!({
                "@type": "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
                "delegator_address": "", // Will be filled by frontend
                "validator_address": validator_address
            })
        })
        .collect();

    Ok(Json(StakingTransactionResponse {
        messages,
        memo: "Claim staking rewards".to_string(),
    }))
}

// ============================================================================
// Helper Functions
// ============================================================================

pub fn parse_validator_status(status: &str) -> ValidatorStatus {
    match status {
        "BOND_STATUS_BONDED" => ValidatorStatus::Bonded,
        "BOND_STATUS_UNBONDING" => ValidatorStatus::Unbonding,
        _ => ValidatorStatus::Unbonded,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_validator_status() {
        assert!(matches!(
            parse_validator_status("BOND_STATUS_BONDED"),
            ValidatorStatus::Bonded
        ));
        assert!(matches!(
            parse_validator_status("BOND_STATUS_UNBONDING"),
            ValidatorStatus::Unbonding
        ));
        assert!(matches!(
            parse_validator_status("BOND_STATUS_UNBONDED"),
            ValidatorStatus::Unbonded
        ));
        assert!(matches!(
            parse_validator_status("unknown"),
            ValidatorStatus::Unbonded
        ));
    }
}
