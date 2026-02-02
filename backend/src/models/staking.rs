use serde::{Deserialize, Serialize};

use super::CurrencyAmount;

/// Validator status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ValidatorStatus {
    Active,
    Inactive,
    Jailed,
}

/// Validator information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Validator {
    /// Operator address (nolusvaloper...)
    pub operator_address: String,
    /// Self-delegate address (nolus1...)
    pub self_delegate_address: String,
    /// Validator name
    pub moniker: String,
    /// Keybase identity
    pub identity: Option<String>,
    /// Website URL
    pub website: Option<String>,
    /// Description
    pub details: Option<String>,
    /// Commission rate (0-1)
    pub commission_rate: f64,
    /// Max commission rate (0-1)
    pub max_commission_rate: f64,
    /// Commission change rate per day (0-1)
    pub max_commission_change_rate: f64,
    /// Total voting power in tokens
    pub voting_power: String,
    /// Voting power as percentage of total
    pub voting_power_percent: f64,
    /// Current status
    pub status: ValidatorStatus,
    /// Whether validator is jailed
    pub jailed: bool,
    /// Uptime percentage (0-100)
    pub uptime: f64,
}

/// User's staking delegation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Delegation {
    /// Validator operator address
    pub validator_address: String,
    /// Validator name for display
    pub validator_moniker: String,
    /// Staked amount
    pub staked: CurrencyAmount,
    /// Pending rewards
    pub rewards: CurrencyAmount,
}

/// Unbonding delegation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnbondingDelegation {
    /// Validator operator address
    pub validator_address: String,
    /// Validator name for display
    pub validator_moniker: String,
    /// Unbonding amount
    pub amount: CurrencyAmount,
    /// When unbonding completes
    pub completion_time: String,
}

/// User's complete staking position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StakingPosition {
    /// All active delegations
    pub delegations: Vec<Delegation>,
    /// All unbonding delegations
    pub unbonding: Vec<UnbondingDelegation>,
    /// Total staked across all validators
    pub total_staked: CurrencyAmount,
    /// Total pending rewards
    pub total_rewards: CurrencyAmount,
}

/// Staking parameters from the chain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StakingParams {
    /// Unbonding period in seconds
    pub unbonding_time: u64,
    /// Maximum number of validators
    pub max_validators: u32,
    /// Maximum unbonding entries per pair
    pub max_entries: u32,
    /// Number of historical entries to persist
    pub historical_entries: u32,
    /// Bond denomination
    pub bond_denom: String,
}

/// Parameters for delegation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DelegateParams {
    pub validator_address: String,
    pub amount: String,
}

/// Parameters for undelegation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UndelegateParams {
    pub validator_address: String,
    pub amount: String,
}

/// Parameters for redelegation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedelegateParams {
    pub src_validator_address: String,
    pub dst_validator_address: String,
    pub amount: String,
}
