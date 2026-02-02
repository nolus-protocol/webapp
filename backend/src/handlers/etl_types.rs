//! ETL API Response Types
//!
//! This module defines strongly-typed response structures for ETL API endpoints.
//! These types provide compile-time guarantees and better documentation for
//! the data returned by the ETL service.

use serde::{Deserialize, Serialize};

// ============================================================================
// Global Stats Types
// ============================================================================

/// Total Value Locked (TVL) response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TvlResponse {
    pub total_value_locked: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub by_protocol: Option<Vec<ProtocolTvl>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolTvl {
    pub protocol: String,
    pub value_locked: String,
}

/// Transaction volume response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxVolumeResponse {
    pub total_tx_value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub period: Option<String>,
}

/// Buyback total response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuybackTotalResponse {
    pub buyback_total: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
}

/// Revenue response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueResponse {
    pub revenue: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub period: Option<String>,
}

// ============================================================================
// Position Stats Types
// ============================================================================

/// Open position value response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenPositionValueResponse {
    pub open_position_value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<u64>,
}

/// Open interest response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenInterestResponse {
    pub open_interest: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub long: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub short: Option<String>,
}

/// Unrealized PnL response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnrealizedPnlResponse {
    pub unrealized_pnl: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub positive_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub negative_count: Option<u64>,
}

/// Realized PnL stats response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealizedPnlStatsResponse {
    pub total_realized_pnl: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub winners: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub losers: Option<u64>,
}

// ============================================================================
// Lending/Earn Stats Types
// ============================================================================

/// Supplied funds response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuppliedFundsResponse {
    pub supplied_funds: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub by_protocol: Option<Vec<ProtocolSupplied>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolSupplied {
    pub protocol: String,
    pub supplied: String,
}

/// Leased assets response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeasedAssetsResponse {
    pub leased_assets: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub by_asset: Option<Vec<AssetLeased>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetLeased {
    pub asset: String,
    pub amount: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value_usd: Option<String>,
}

/// Pools response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolsResponse {
    pub pools: Vec<PoolInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolInfo {
    pub protocol: String,
    pub lpp_address: String,
    pub lpn_ticker: String,
    pub total_deposits: String,
    pub total_borrowed: String,
    pub utilization: f64,
    pub apr: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deposit_cap: Option<String>,
}

// ============================================================================
// User-Specific Types
// ============================================================================

/// User earnings response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarningsResponse {
    pub address: String,
    pub total_earnings: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub by_protocol: Option<Vec<ProtocolEarnings>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolEarnings {
    pub protocol: String,
    pub earnings: String,
}

/// User realized PnL response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRealizedPnlResponse {
    pub address: String,
    pub realized_pnl: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trade_count: Option<u64>,
}

/// User realized PnL detailed data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealizedPnlDataResponse {
    pub address: String,
    pub trades: Vec<RealizedTrade>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealizedTrade {
    pub lease_address: String,
    pub pnl: String,
    pub pnl_percent: String,
    pub close_time: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position_ticker: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position_amount: Option<String>,
}

/// Position debt value response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionDebtValueResponse {
    pub address: String,
    pub total_debt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub positions: Option<Vec<PositionDebt>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionDebt {
    pub lease_address: String,
    pub debt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub debt_usd: Option<String>,
}

/// History stats response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryStatsResponse {
    pub address: String,
    pub total_trades: u64,
    pub winning_trades: u64,
    pub losing_trades: u64,
    pub total_pnl: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub win_rate: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avg_pnl: Option<String>,
}

// ============================================================================
// Time Series Types
// ============================================================================

/// PnL over time response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PnlOverTimeResponse {
    pub address: String,
    pub interval: String,
    pub data: Vec<PnlDataPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PnlDataPoint {
    pub timestamp: String,
    pub pnl: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cumulative_pnl: Option<String>,
}

/// Price series response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceSeriesResponse {
    pub key: String,
    pub interval: String,
    pub data: Vec<PriceDataPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceDataPoint {
    pub timestamp: String,
    pub price: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub volume: Option<String>,
}

/// Supplied/Borrowed history response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSeriesResponse {
    pub period: String,
    pub data: Vec<TimeSeriesDataPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSeriesDataPoint {
    pub timestamp: String,
    pub supplied: String,
    pub borrowed: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub utilization: Option<f64>,
}

// ============================================================================
// Lease Types
// ============================================================================

/// Lease opening data response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseOpeningResponse {
    pub lease: String,
    pub down_payment: String,
    pub down_payment_usd: String,
    pub loan_amount: String,
    pub loan_asset: String,
    pub position_amount: String,
    pub position_asset: String,
    pub open_price: String,
    pub open_time: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fee: Option<String>,
}

/// Leases monthly stats
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeasesMonthlyResponse {
    pub data: Vec<MonthlyLeaseStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthlyLeaseStats {
    pub month: String,
    pub opened: u64,
    pub closed: u64,
    pub liquidated: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_volume: Option<String>,
}

/// Lease closing (PnL) paginated response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseClosingResponse {
    pub data: Vec<LeaseClosingEntry>,
    pub total: u64,
    pub skip: u64,
    pub limit: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseClosingEntry {
    pub lease_address: String,
    pub pnl: String,
    pub pnl_percent: String,
    pub close_time: String,
    pub close_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position_ticker: Option<String>,
}

/// Leases search response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeasesSearchResponse {
    pub data: Vec<LeaseSearchEntry>,
    pub total: u64,
    pub skip: u64,
    pub limit: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseSearchEntry {
    pub lease_address: String,
    pub status: String,
    pub protocol: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position_ticker: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub position_amount: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pnl: Option<String>,
}

// ============================================================================
// Transaction Types
// ============================================================================

/// Transactions paginated response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxsResponse {
    pub data: Vec<TxEntry>,
    pub total: u64,
    pub skip: u64,
    pub limit: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxEntry {
    pub hash: String,
    pub height: u64,
    pub timestamp: String,
    pub tx_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

/// LP Withdraw response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LpWithdrawResponse {
    pub tx: String,
    pub amount: String,
    pub asset: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount_usd: Option<String>,
}

// ============================================================================
// Tests
// ============================================================================
