use serde::{Deserialize, Serialize};

use super::CurrencyAmount;

/// Earn/lending pool information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarnPool {
    /// Pool identifier
    pub pool_id: String,
    /// Protocol name
    pub protocol: String,
    /// Currency deposited in this pool
    pub currency_key: String,
    /// Total value deposited
    pub total_deposited: CurrencyAmount,
    /// Current APY (annual percentage yield)
    pub apy: f64,
    /// Pool utilization rate (0-1)
    pub utilization: f64,
    /// Available liquidity for withdrawal
    pub available_liquidity: CurrencyAmount,
    /// LPP contract address
    pub lpp_address: String,
}

/// User's position in an earn pool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarnPosition {
    /// Pool identifier
    pub pool_id: String,
    /// Protocol name
    pub protocol: String,
    /// Currency deposited
    pub currency_key: String,
    /// Amount deposited
    pub deposited: CurrencyAmount,
    /// Rewards earned (accrued interest)
    pub earned: CurrencyAmount,
    /// Current APY for this position
    pub current_apy: f64,
    /// Timestamp when deposited
    pub deposited_at: String,
}

/// Parameters for depositing into an earn pool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DepositParams {
    pub pool_id: String,
    pub amount: String,
    pub currency: String,
}

/// Parameters for withdrawing from an earn pool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WithdrawParams {
    pub pool_id: String,
    pub amount: String,
}

/// Earn pool statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarnPoolStats {
    pub pool_id: String,
    /// Historical APY data points
    pub apy_history: Vec<ApyDataPoint>,
    /// Historical TVL data points
    pub tvl_history: Vec<TvlDataPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApyDataPoint {
    pub timestamp: String,
    pub apy: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TvlDataPoint {
    pub timestamp: String,
    pub tvl_usd: String,
}
