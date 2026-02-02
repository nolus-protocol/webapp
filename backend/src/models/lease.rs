use serde::{Deserialize, Serialize};

use super::CurrencyAmount;

/// Lease status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LeaseStatus {
    Active,
    Liquidated,
    Closed,
    PaidOff,
}

/// A lease position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Lease {
    /// Lease contract address
    pub address: String,
    /// Owner wallet address
    pub owner: String,
    /// Protocol name
    pub protocol: String,
    /// Current status
    pub status: LeaseStatus,
    /// Collateral asset
    pub collateral: CurrencyAmount,
    /// Originally borrowed amount
    pub borrowed: CurrencyAmount,
    /// Current debt (principal + interest)
    pub debt: CurrencyAmount,
    /// Loan-to-value ratio (0-1)
    pub ltv: f64,
    /// Price at which liquidation occurs
    pub liquidation_price: String,
    /// Current interest rate (annual %)
    pub interest_rate: f64,
    /// Opening timestamp
    pub opened_at: String,
    /// Closing timestamp if closed
    pub closed_at: Option<String>,
}

/// Lease history entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseHistoryEntry {
    pub tx_hash: String,
    pub action: LeaseAction,
    pub amount: Option<CurrencyAmount>,
    pub timestamp: String,
    pub block_height: u64,
}

/// Actions that can be performed on a lease
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LeaseAction {
    Open,
    Repay,
    Close,
    MarketClose,
    Liquidate,
    AddCollateral,
}

/// Parameters for opening a lease
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenLeaseParams {
    pub protocol: String,
    pub down_payment_currency: String,
    pub down_payment_amount: String,
    pub borrow_currency: String,
    pub borrow_amount: String,
    pub collateral_currency: String,
}

/// Parameters for repaying a lease
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepayLeaseParams {
    pub lease_address: String,
    pub amount: String,
    pub currency: String,
}

/// Lease quote for opening
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseQuote {
    pub down_payment: CurrencyAmount,
    pub borrow: CurrencyAmount,
    pub collateral: CurrencyAmount,
    pub initial_ltv: f64,
    pub liquidation_price: String,
    pub estimated_interest_rate: f64,
    pub estimated_gas: u64,
}
