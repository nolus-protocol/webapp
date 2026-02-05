/**
 * Webapp Configuration types
 */

export interface DownpaymentRange {
  min: number;
  max: number;
}

/** Response from GET /api/leases/config/{protocol} */
export interface LeaseConfigResponse {
  protocol: string;
  downpayment_ranges: Record<string, DownpaymentRange>;
  min_asset: AmountSpec;
  min_transaction: AmountSpec;
}

export interface AmountSpec {
  amount: string;
  ticker: string;
}

/** Response from GET /api/swap/config */
export interface SwapConfigResponse {
  [key: string]: unknown;
}

/** Response from GET /api/governance/hidden-proposals */
export interface HiddenProposalsResponse {
  hidden_ids: string[];
}
