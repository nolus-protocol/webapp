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
use tracing::debug;

use crate::error::AppError;
use crate::query_types::AddressQuery;
use crate::AppState;

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
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
    pub status: ValidatorStatus,
    pub jailed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ValidatorStatus {
    Bonded,
    Unbonding,
    Unbonded,
}



#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StakingPosition {
    pub validator_address: String,
    pub validator_moniker: Option<String>,
    pub shares: String,
    pub balance: BalanceInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceInfo {
    pub denom: String,
    pub amount: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnbondingPosition {
    pub validator_address: String,
    pub validator_moniker: Option<String>,
    pub entries: Vec<UnbondingEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnbondingEntry {
    pub creation_height: String,
    pub completion_time: String,
    pub initial_balance: String,
    pub balance: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StakingPositionsResponse {
    pub delegations: Vec<StakingPosition>,
    pub unbonding: Vec<UnbondingPosition>,
    pub rewards: Vec<ValidatorReward>,
    pub total_staked: String,
    pub total_rewards: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidatorReward {
    pub validator_address: String,
    pub reward: Vec<BalanceInfo>,
}

#[derive(Debug, Deserialize)]
pub struct DelegateRequest {
    pub validator_address: String,
    pub amount: String,
    pub denom: String,
}

#[derive(Debug, Deserialize)]
pub struct UndelegateRequest {
    pub validator_address: String,
    pub amount: String,
    pub denom: String,
}

#[derive(Debug, Deserialize)]
pub struct RedelegateRequest {
    pub src_validator_address: String,
    pub dst_validator_address: String,
    pub amount: String,
    pub denom: String,
}

#[derive(Debug, Deserialize)]
pub struct ClaimRewardsRequest {
    pub validator_addresses: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct StakingTransactionResponse {
    pub messages: Vec<serde_json::Value>,
    pub memo: String,
}

#[derive(Debug, Serialize, Deserialize)]
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

/// GET /api/staking/validators
/// Returns list of all bonded validators
/// Uses caching with request coalescing to prevent thundering herd
pub async fn get_validators(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Validator>>, AppError> {
    debug!("Getting validators");

    // Use get_or_fetch to coalesce concurrent requests
    let result = state
        .cache
        .data
        .get_or_fetch(crate::cache_keys::validators::ALL_VALIDATORS, || {
            let state = state.clone();
            async move { fetch_validators_internal(state).await }
        })
        .await
        .map_err(|e| AppError::ExternalApi {
            api: "validators".to_string(),
            message: e,
        })?;

    // Deserialize the cached JSON back to Vec<Validator>
    let validators: Vec<Validator> = serde_json::from_value(result).map_err(|e| {
        AppError::Internal(format!("Failed to deserialize validators: {}", e))
    })?;

    Ok(Json(validators))
}

/// Internal function to fetch validators (called by cache)
async fn fetch_validators_internal(
    state: Arc<AppState>,
) -> Result<serde_json::Value, String> {
    let validators = state
        .chain_client
        .get_validators()
        .await
        .map_err(|e| e.to_string())?;

    let result: Vec<Validator> = validators
        .into_iter()
        .map(|v| Validator {
            operator_address: v.operator_address,
            moniker: v.description.moniker,
            identity: v.description.identity,
            website: v.description.website,
            details: v.description.details,
            commission_rate: v.commission.commission_rates.rate,
            max_commission_rate: v.commission.commission_rates.max_rate,
            max_commission_change_rate: v.commission.commission_rates.max_change_rate,
            tokens: v.tokens,
            delegator_shares: v.delegator_shares,
            status: parse_validator_status(&v.status),
            jailed: v.jailed,
        })
        .collect();

    serde_json::to_value(result).map_err(|e| e.to_string())
}

/// GET /api/staking/validators/:address
/// Returns details for a specific validator
pub async fn get_validator(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<Json<Validator>, AppError> {
    debug!("Getting validator: {}", address);

    // Get all validators and find the one we need
    // In a production system, we'd have a dedicated endpoint
    let validators = state.chain_client.get_validators().await?;

    let validator = validators
        .into_iter()
        .find(|v| v.operator_address == address)
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Validator {}", address),
        })?;

    Ok(Json(Validator {
        operator_address: validator.operator_address,
        moniker: validator.description.moniker,
        identity: validator.description.identity,
        website: validator.description.website,
        details: validator.description.details,
        commission_rate: validator.commission.commission_rates.rate,
        max_commission_rate: validator.commission.commission_rates.max_rate,
        max_commission_change_rate: validator.commission.commission_rates.max_change_rate,
        tokens: validator.tokens,
        delegator_shares: validator.delegator_shares,
        status: parse_validator_status(&validator.status),
        jailed: validator.jailed,
    }))
}

/// GET /api/staking/positions?delegator=...
/// Returns all staking positions for a delegator
pub async fn get_positions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<AddressQuery>,
) -> Result<Json<StakingPositionsResponse>, AppError> {
    debug!("Getting staking positions for: {}", query.address);

    // Fetch delegations, rewards, unbonding, and validators in parallel
    debug!("Fetching delegations, rewards, unbonding, and validators...");
    let (delegations_result, rewards_result, unbonding_result, validators_result) = tokio::join!(
        state.chain_client.get_delegations(&query.address),
        state.chain_client.get_rewards(&query.address),
        state.chain_client.get_unbonding_delegations(&query.address),
        state.chain_client.get_validators(),
    );
    debug!("Delegations result: {:?}", delegations_result.is_ok());
    debug!("Rewards result: {:?}", rewards_result.is_ok());
    debug!("Unbonding result: {:?}", unbonding_result.is_ok());
    debug!("Validators result: {:?}", validators_result.is_ok());

    let delegations = delegations_result.unwrap_or_default();
    let rewards_response = rewards_result.ok();
    let unbonding_delegations = unbonding_result.unwrap_or_default();
    let validators = validators_result.ok();

    // Build delegations list
    let delegation_positions: Vec<StakingPosition> = delegations
        .iter()
        .map(|d| {
            let moniker = validators.as_ref().and_then(|vs| {
                vs.iter()
                    .find(|v| v.operator_address == d.delegation.validator_address)
                    .map(|v| v.description.moniker.clone())
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
                    reward: vr
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
    let total_rewards: f64 = rewards_response
        .as_ref()
        .map(|r| {
            r.total
                .iter()
                .filter_map(|b| b.amount.parse::<f64>().ok())
                .sum()
        })
        .unwrap_or(0.0);

    // Build unbonding positions
    let unbonding_positions: Vec<UnbondingPosition> = unbonding_delegations
        .iter()
        .map(|u| {
            let moniker = validators.as_ref().and_then(|vs| {
                vs.iter()
                    .find(|v| v.operator_address == u.validator_address)
                    .map(|v| v.description.moniker.clone())
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
        total_rewards: format!("{:.0}", total_rewards),
    }))
}

/// GET /api/staking/params
/// Returns staking parameters
pub async fn get_staking_params(
    State(state): State<Arc<AppState>>,
) -> Result<Json<StakingParams>, AppError> {
    debug!("Getting staking params");

    // Query staking params from chain
    let url = format!(
        "{}/cosmos/staking/v1beta1/params",
        state.config.external.nolus_rest_url
    );

    let response = reqwest::get(&url).await.map_err(|e| AppError::ChainRpc {
        chain: "nolus".to_string(),
        message: format!("Failed to get staking params: {}", e),
    })?;

    if !response.status().is_success() {
        return Err(AppError::ChainRpc {
            chain: "nolus".to_string(),
            message: format!("HTTP {}", response.status()),
        });
    }

    #[derive(Deserialize)]
    struct ParamsResponse {
        params: StakingParamsRaw,
    }

    #[derive(Deserialize)]
    struct StakingParamsRaw {
        unbonding_time: String,
        max_validators: u32,
        max_entries: u32,
        bond_denom: String,
        min_commission_rate: String,
    }

    let result: ParamsResponse = response.json().await.map_err(|e| AppError::ChainRpc {
        chain: "nolus".to_string(),
        message: format!("Failed to parse staking params: {}", e),
    })?;

    Ok(Json(StakingParams {
        unbonding_time: result.params.unbonding_time,
        max_validators: result.params.max_validators,
        max_entries: result.params.max_entries,
        bond_denom: result.params.bond_denom,
        min_commission_rate: result.params.min_commission_rate,
    }))
}

/// POST /api/staking/delegate
/// Build transaction messages to delegate
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

/// POST /api/staking/undelegate
/// Build transaction messages to undelegate
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

/// POST /api/staking/redelegate
/// Build transaction messages to redelegate
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

/// POST /api/staking/claim-rewards
/// Build transaction messages to claim staking rewards
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

fn parse_validator_status(status: &str) -> ValidatorStatus {
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
        assert!(matches!(parse_validator_status("BOND_STATUS_BONDED"), ValidatorStatus::Bonded));
        assert!(matches!(parse_validator_status("BOND_STATUS_UNBONDING"), ValidatorStatus::Unbonding));
        assert!(matches!(parse_validator_status("BOND_STATUS_UNBONDED"), ValidatorStatus::Unbonded));
        assert!(matches!(parse_validator_status("unknown"), ValidatorStatus::Unbonded));
    }
}
