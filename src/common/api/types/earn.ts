/**
 * Earn types - matches backend/src/handlers/earn.rs
 */

export interface EarnPool {
  protocol: string;
  lpp_address: string;
  currency: string;
  total_deposited: string;
  total_deposited_usd?: string;
  apy: number;
  utilization: number;
  available_liquidity: string;
  deposit_capacity?: string;
}

export interface EarnPosition {
  protocol: string;
  lpp_address: string;
  currency: string;
  deposited_nlpn: string;
  deposited_lpn: string;
  deposited_usd?: string;
  lpp_price: string;
  current_apy: number;
}

export interface EarnPositionsResponse {
  positions: EarnPosition[];
  total_deposited_usd: string;
}

export interface EarnStats {
  total_deposited: string;
  total_deposited_usd: string;
  average_apy: number;
  total_lenders: number;
  dispatcher_rewards?: string;
}
