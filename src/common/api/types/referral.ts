/**
 * Referral types - matches backend/src/handlers/referral.rs
 */

/** Referrer tier (affects reward percentage) */
export type ReferrerTier = "general" | "premium";

/** Referrer status */
export type ReferrerStatus = "active" | "disabled";

/** Referral status */
export type ReferralStatusType = "active" | "inactive";

/** Reward status */
export type RewardStatusType = "pending" | "included" | "paid";

/** Payout status */
export type PayoutStatusType = "pending" | "submitted" | "confirmed" | "failed";

/** Validate code response */
export interface ValidateCodeResponse {
  valid: boolean;
  referral_code?: string;
  referrer_wallet?: string;
}

/** Register as referrer response */
export interface RegisterReferrerResponse {
  wallet_address: string;
  referral_code: string;
  tier: ReferrerTier;
  created_at: string;
  already_registered: boolean;
}

/** Referrer info */
export interface ReferrerInfo {
  wallet_address: string;
  referral_code: string;
  tier: ReferrerTier;
  status: ReferrerStatus;
  created_at: string;
}

/** Referrer statistics */
export interface ReferrerStats {
  total_referrals: number;
  active_referrals: number;
  total_rewards_earned: string;
  total_rewards_paid: string;
  pending_rewards: string;
  rewards_denom: string;
  bonus_rewards_earned: number;
  bonus_rewards_paid: number;
  total_bonus_amount_earned: string;
  total_bonus_amount_paid: string;
}

/** Combined referrer stats response */
export interface ReferrerStatsResponse {
  referrer: ReferrerInfo;
  stats: ReferrerStats;
}

/** Single referral */
export interface ReferralInfo {
  id: number;
  referred_wallet: string;
  assigned_at: string;
  status: ReferralStatusType;
}

/** Referrals list response */
export interface ReferralsListResponse {
  referrals: ReferralInfo[];
  total: number;
  limit: number;
  offset: number;
}

/** Single reward */
export interface ReferralReward {
  id: number;
  lease_id: string;
  referred_wallet: string;
  period_start: string;
  period_end: string;
  interest_collected: string;
  interest_denom: string;
  reward_amount: string;
  reward_denom: string;
  status: RewardStatusType;
  created_at: string;
}

/** Rewards list response */
export interface RewardsListResponse {
  rewards: ReferralReward[];
  total: number;
  limit: number;
  offset: number;
}

/** Single payout */
export interface ReferralPayout {
  id: number;
  total_amount: string;
  denom: string;
  tx_hash?: string;
  status: PayoutStatusType;
  created_at: string;
  executed_at?: string;
}

/** Payouts list response */
export interface PayoutsListResponse {
  payouts: ReferralPayout[];
  total: number;
  limit: number;
  offset: number;
}

/** Assign referral response */
export interface AssignReferralResponse {
  id: number;
  referrer_wallet: string;
  referred_wallet: string;
  referral_code: string;
  assigned_at: string;
}
