/**
 * Lease types - matches backend/src/handlers/leases.rs
 */

import type { CoinAmount } from "./common";

export interface LeaseInfo {
  address: string;
  protocol: string;
  status: LeaseStatusType;
  opened_at?: string;
  amount: LeaseAssetInfo;
  debt: LeaseDebtInfo;
  interest: LeaseInterestInfo;
  liquidation_price?: string;
  pnl?: LeasePnlInfo;
  /** Close policy (stop loss / take profit) */
  close_policy?: LeaseClosePolicy;
  /** Time until overdue interest collection (nanoseconds as string) */
  overdue_collect_in?: string;
  /** In-progress operation (if any) */
  in_progress?: LeaseInProgress;
  /** Opening state info (for leases still opening) */
  opening_info?: LeaseOpeningStateInfo;
  /** Historical data from ETL */
  etl_data?: LeaseEtlData;
}

export type LeaseStatusType = "opening" | "opened" | "paid_off" | "closing" | "closed" | "liquidated";

export interface LeaseAssetInfo {
  ticker: string;
  amount: string;
  amount_usd?: string;
}

export interface LeaseDebtInfo {
  ticker: string;
  principal: string;
  overdue_margin: string;
  overdue_interest: string;
  due_margin: string;
  due_interest: string;
  total: string;
  total_usd?: string;
}

export interface LeaseInterestInfo {
  loan_rate: number;
  margin_rate: number;
  annual_rate_percent: number;
}

export interface LeasePnlInfo {
  amount: string;
  percent: string;
  downpayment: string;
}

export interface LeaseClosePolicy {
  /** Stop loss threshold (permille) */
  stop_loss?: number;
  /** Take profit threshold (permille) */
  take_profit?: number;
}

export type LeaseInProgress =
  | { opening: { stage?: string } }
  | { repayment: Record<string, never> }
  | { close: Record<string, never> }
  | { liquidation: { cause?: string } }
  | { transfer_in: { stage?: string } };

export interface LeaseOpeningStateInfo {
  /** Currency being leased */
  currency: string;
  /** Downpayment amount */
  downpayment: LeaseAssetInfo;
  /** Loan amount */
  loan: LeaseAssetInfo;
  /** Loan interest rate (permille) */
  loan_interest_rate: number;
}

export interface LeaseEtlData {
  /** Downpayment amount in USD */
  downpayment_amount?: string;
  /** Opening price per asset */
  price?: string;
  /** LPN price at opening (for short positions) */
  lpn_price?: string;
  /** DEX/swap fee */
  fee?: string;
  /** Lease asset symbol */
  ls_asset_symbol?: string;
  /** Position ticker */
  lease_position_ticker?: string;
  /** Repayment value (total repaid so far) */
  repayment_value?: string;
  /** Transaction history */
  history?: LeaseHistoryEntry[];
}

export interface LeaseHistoryEntry {
  tx_hash?: string;
  action: string;
  amount?: string;
  symbol?: string;
  timestamp?: string;
}

export interface LeaseQuoteRequest {
  protocol: string;
  downpayment: CoinAmount;
  lease_currency: string;
  max_ltd?: string;
}

export interface LeaseQuoteResponse {
  borrow: CoinAmount;
  annual_interest_rate: string;
  annual_interest_rate_margin: string;
  total_amount: CoinAmount;
  loan_to_deposit: string;
}

export interface LeasesResponse {
  leases: LeaseInfo[];
  total_collateral_usd: string;
  total_debt_usd: string;
}
