/**
 * Zero Interest types - matches backend/src/handlers/zero_interest.rs
 */

export interface ZeroInterestConfig {
  enabled: boolean;
  max_payment_amount: string;
  min_lease_value: string;
  max_active_payments: number;
  supported_denoms: string[];
}

export interface ZeroInterestEligibility {
  eligible: boolean;
  reason?: string;
  max_amount?: string;
  available_slots?: number;
}

export interface ZeroInterestPayment {
  id: string;
  lease_address: string;
  amount: string;
  denom: string;
  payment_date: string;
  status: "pending" | "completed" | "failed" | "cancelled";
}

// =========================================================================
// Campaign types - Zero-interest campaigns from Payments Manager
// =========================================================================

export interface ZeroInterestCampaign {
  id: number;
  name: string;
  active: boolean;
  /** Eligible protocol/leaser addresses (empty = all protocols) */
  eligible_protocols: string[];
  /** Eligible currency tickers (empty = all currencies) */
  eligible_currencies: string[];
  /** Eligible wallet addresses (empty = all wallets) */
  eligible_wallets: string[];
  /** Campaign start date (ISO 8601) */
  start_date: string | null;
  /** Campaign end date (ISO 8601) */
  end_date: string | null;
  /** Human-readable description */
  description?: string;
}

export interface ActiveCampaignsResponse {
  /** List of active campaigns */
  campaigns: ZeroInterestCampaign[];
  /** All currencies eligible across any campaign */
  all_eligible_currencies: string[];
  /** All protocols eligible across any campaign */
  all_eligible_protocols: string[];
  /** True if any campaign has no restrictions */
  has_universal_campaign: boolean;
}

export interface CampaignEligibilityResponse {
  eligible: boolean;
  matching_campaigns: CampaignMatch[];
  reason?: string;
}

export interface CampaignMatch {
  id: number;
  name: string;
}
