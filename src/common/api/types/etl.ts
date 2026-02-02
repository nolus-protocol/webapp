/**
 * ETL API Types - Types for ETL (Extract, Transform, Load) endpoints
 *
 * These endpoints provide analytics and historical data from the ETL service.
 * Types must match backend/src/handlers/etl_types.rs
 */

// =============================================================================
// Stats Overview Types
// =============================================================================

export interface ProtocolTvl {
  protocol: string;
  value_locked: string;
}

/**
 * Total Value Locked response
 */
export interface TvlResponse {
  total_value_locked: string;
  by_protocol?: ProtocolTvl[];
}

/**
 * Transaction volume response
 */
export interface TxVolumeResponse {
  total_tx_value: string;
  period?: string;
}

/**
 * Buyback total response
 */
export interface BuybackTotalResponse {
  buyback_total: string;
  currency?: string;
}

/**
 * Realized PnL stats response
 */
export interface RealizedPnlStatsResponse {
  total_realized_pnl: string;
  winners?: number;
  losers?: number;
}

/**
 * Revenue response
 */
export interface RevenueResponse {
  revenue: string;
  period?: string;
}

/**
 * Stats overview batch response
 */
export interface StatsOverviewBatchResponse {
  tvl: TvlResponse | null;
  tx_volume: TxVolumeResponse | null;
  buyback_total: BuybackTotalResponse | null;
  realized_pnl_stats: RealizedPnlStatsResponse | null;
  revenue: RevenueResponse | null;
}

// =============================================================================
// Loans Stats Types
// =============================================================================

/**
 * Open position value response
 */
export interface OpenPositionValueResponse {
  open_position_value: string;
  count?: number;
}

/**
 * Open interest response
 */
export interface OpenInterestResponse {
  open_interest: string;
  long?: string;
  short?: string;
}

/**
 * Loans stats batch response
 */
export interface LoansStatsBatchResponse {
  open_position_value: OpenPositionValueResponse | null;
  open_interest: OpenInterestResponse | null;
}

// =============================================================================
// User Dashboard Types
// =============================================================================

export interface ProtocolEarnings {
  protocol: string;
  earnings: string;
}

/**
 * User earnings response
 */
export interface EarningsResponse {
  address: string;
  total_earnings: string;
  by_protocol?: ProtocolEarnings[];
}

/**
 * User realized PnL response
 */
export interface UserRealizedPnlResponse {
  address: string;
  realized_pnl: string;
  trade_count?: number;
}

export interface PositionDebt {
  lease_address: string;
  debt: string;
  debt_usd?: string;
}

/**
 * Position debt value response
 */
export interface PositionDebtValueResponse {
  address: string;
  total_debt: string;
  positions?: PositionDebt[];
}

/**
 * User dashboard batch response
 */
export interface UserDashboardBatchResponse {
  earnings: EarningsResponse | null;
  realized_pnl: UserRealizedPnlResponse | null;
  position_debt_value: PositionDebtValueResponse | null;
}

// =============================================================================
// User History Types
// =============================================================================

/**
 * History stats response
 */
export interface HistoryStatsResponse {
  address: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: string;
  win_rate?: number;
  avg_pnl?: string;
}

export interface RealizedTrade {
  lease_address: string;
  pnl: string;
  pnl_percent: string;
  close_time: string;
  position_ticker?: string;
  position_amount?: string;
}

/**
 * Realized PnL data response
 */
export interface RealizedPnlDataResponse {
  address: string;
  trades: RealizedTrade[];
}

/**
 * User history batch response
 */
export interface UserHistoryBatchResponse {
  history_stats: HistoryStatsResponse | null;
  realized_pnl_data: RealizedPnlDataResponse | null;
}

// =============================================================================
// Chart Data Types
// =============================================================================

/**
 * Price data point
 */
export interface PriceDataPoint {
  timestamp: string;
  price: string;
  volume?: string;
}

/**
 * Price series response
 */
export interface PriceSeriesResponse {
  key: string;
  interval: string;
  data: PriceDataPoint[];
}

/**
 * Legacy price series data point - [timestamp, price]
 * @deprecated Use PriceSeriesResponse instead
 */
export type PriceSeriesDataPoint = [number, number];

/**
 * PnL data point
 */
export interface PnlDataPoint {
  timestamp: string;
  pnl: string;
  cumulative_pnl?: string;
}

/**
 * PnL over time response
 */
export interface PnlOverTimeResponse {
  address: string;
  interval: string;
  data: PnlDataPoint[];
}

/**
 * Legacy PnL over time data point
 * @deprecated Use PnlOverTimeResponse instead
 */
export interface PnlOverTimeDataPoint {
  amount: number;
  date: string;
}

/**
 * Monthly lease stats
 */
export interface MonthlyLeaseStats {
  month: string;
  opened: number;
  closed: number;
  liquidated: number;
  total_volume?: string;
}

/**
 * Leases monthly response
 */
export interface LeasesMonthlyResponse {
  data: MonthlyLeaseStats[];
}

/**
 * Legacy monthly lease data
 * @deprecated Use LeasesMonthlyResponse instead
 */
export interface MonthlyLeaseData {
  month: string;
  count: number;
}

/**
 * Asset leased breakdown
 */
export interface AssetLeased {
  asset: string;
  amount: string;
  value_usd?: string;
}

/**
 * Leased assets response
 */
export interface LeasedAssetsResponse {
  leased_assets: string;
  by_asset?: AssetLeased[];
}

/**
 * Time series data point
 */
export interface TimeSeriesDataPoint {
  timestamp: string;
  supplied: string;
  borrowed: string;
  utilization?: number;
}

/**
 * Time series response (supply/borrow history)
 */
export interface TimeSeriesResponse {
  period: string;
  data: TimeSeriesDataPoint[];
}

/**
 * Legacy supply/borrow history data point
 * @deprecated Use TimeSeriesResponse instead
 */
export interface SupplyBorrowHistoryDataPoint {
  timestamp: string;
  supplied: string;
  borrowed: string;
}

// =============================================================================
// Transaction Types
// =============================================================================

/**
 * Transaction entry
 */
export interface TxEntry {
  hash: string;
  height: number;
  timestamp: string;
  tx_type: string;
  amount?: string;
  asset?: string;
  status?: string;
}

/**
 * Transactions paginated response
 */
export interface TxsResponse {
  data: TxEntry[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * Legacy ETL transaction (before transformation)
 * @deprecated Use TxsResponse instead
 */
export interface EtlTransaction {
  tx_hash: string;
  timestamp: string;
  type: string;
  from: string;
  to: string;
  value: string;
  index: number;
}

/**
 * Transaction filters
 */
export interface TransactionFilters {
  positions?: boolean;
  transfers?: boolean;
  earn?: boolean;
  staking?: boolean;
  positions_ids?: string[];
}

// =============================================================================
// Pool Types
// =============================================================================

/**
 * Pool info
 */
export interface PoolInfo {
  protocol: string;
  lpp_address: string;
  lpn_ticker: string;
  total_deposits: string;
  total_borrowed: string;
  utilization: number;
  apr: number;
  deposit_cap?: string;
}

/**
 * Pools response
 */
export interface PoolsResponse {
  pools: PoolInfo[];
}

/**
 * Legacy pool data from ETL
 * @deprecated Use PoolsResponse instead
 */
export interface EtlPoolData {
  protocol: string;
  apy: number;
  utilization: number;
}

// =============================================================================
// Lease Types
// =============================================================================

/**
 * Lease opening response
 */
export interface LeaseOpeningResponse {
  lease: string;
  down_payment: string;
  down_payment_usd: string;
  loan_amount: string;
  loan_asset: string;
  position_amount: string;
  position_asset: string;
  open_price: string;
  open_time: string;
  fee?: string;
}

/**
 * Legacy lease opening data
 * @deprecated Use LeaseOpeningResponse instead
 */
export interface LeaseOpeningData {
  downpayment_amount: string;
  price: string;
  fee: string;
  ls_asset_symbol: string;
}

/**
 * Lease closing entry
 */
export interface LeaseClosingEntry {
  lease_address: string;
  pnl: string;
  pnl_percent: string;
  close_time: string;
  close_type: string;
  position_ticker?: string;
}

/**
 * Lease closing paginated response
 */
export interface LeaseClosingResponse {
  data: LeaseClosingEntry[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * Legacy PnL log entry
 * @deprecated Use LeaseClosingResponse instead
 */
export interface PnlLogEntry {
  lease_address: string;
  pnl: string;
  pnl_percent: string;
  closed_at: string;
}

/**
 * Lease search entry
 */
export interface LeaseSearchEntry {
  lease_address: string;
  status: string;
  protocol: string;
  position_ticker?: string;
  position_amount?: string;
  pnl?: string;
}

/**
 * Leases search paginated response
 */
export interface LeasesSearchResponse {
  data: LeaseSearchEntry[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * LP withdraw response
 */
export interface LpWithdrawResponse {
  tx: string;
  amount: string;
  asset: string;
  amount_usd?: string;
}

/**
 * Legacy LP withdraw data
 * @deprecated Use LpWithdrawResponse instead
 */
export interface LpWithdrawData {
  LP_amnt_asset: string;
}
