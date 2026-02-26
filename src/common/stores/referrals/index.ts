/**
 * Referrals Store - Referral Program integration
 *
 * Manages referral program state including:
 * - Referrer registration and code management
 * - Referral tracking and statistics
 * - Rewards and payouts history
 *
 * Browser HTTP cache handles caching.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  BackendApi,
  type ReferrerInfo,
  type ReferrerStats,
  type ReferrerStatsResponse,
  type ReferralInfo,
  type ReferralReward,
  type ReferralPayout,
  type ValidateCodeResponse,
  type RegisterReferrerResponse,
  type AssignReferralResponse
} from "@/common/api";

export const useReferralsStore = defineStore("referrals", () => {
  // =========================================================================
  // State
  // =========================================================================

  /** Current user's referrer info (null if not a referrer) */
  const referrer = ref<ReferrerInfo | null>(null);

  /** Current user's referral statistics */
  const stats = ref<ReferrerStats | null>(null);

  /** List of users referred by current user */
  const referrals = ref<ReferralInfo[]>([]);

  /** Rewards history (loaded on demand) */
  const rewards = ref<ReferralReward[]>([]);
  const rewardsTotal = ref(0);

  /** Payouts history (loaded on demand) */
  const payouts = ref<ReferralPayout[]>([]);
  const payoutsTotal = ref(0);

  /** Loading states */
  const loading = ref(false);
  const loadingRewards = ref(false);
  const loadingPayouts = ref(false);

  /** Error state */
  const error = ref<string | null>(null);

  /** Last updated timestamp */
  const lastUpdated = ref<Date | null>(null);

  /** Current wallet address being tracked */
  const currentWallet = ref<string | null>(null);

  // =========================================================================
  // Computed
  // =========================================================================

  /** Whether the current user is a registered referrer */
  const isReferrer = computed(() => referrer.value !== null);

  /** Current user's referral code */
  const referralCode = computed(() => referrer.value?.referral_code || null);

  /** Current user's tier */
  const tier = computed(() => referrer.value?.tier || null);

  /** Whether the referrer account is active */
  const isActive = computed(() => referrer.value?.status === "active");

  /** Total referrals count */
  const totalReferrals = computed(() => stats.value?.total_referrals || 0);

  /** Active referrals count */
  const activeReferrals = computed(() => stats.value?.active_referrals || 0);

  /** Pending rewards (not yet paid out) */
  const pendingRewards = computed(() => stats.value?.pending_rewards || "0");

  /** Total rewards earned */
  const totalRewardsEarned = computed(() => stats.value?.total_rewards_earned || "0");

  /** Rewards denomination */
  const rewardsDenom = computed(() => stats.value?.rewards_denom || "unls");

  /** Bonus rewards earned */
  const bonusRewardsEarned = computed(() => stats.value?.bonus_rewards_earned || 0);

  /** Generate shareable referral link */
  const referralLink = computed(() => {
    if (!referralCode.value) return null;
    // Use current origin for the referral link
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/?ref=${referralCode.value}`;
  });

  // =========================================================================
  // API Methods
  // =========================================================================

  /**
   * Validate a referral code (public, no wallet required)
   */
  async function validateCode(code: string): Promise<ValidateCodeResponse> {
    try {
      return await BackendApi.validateReferralCode(code);
    } catch (e) {
      console.error("[ReferralsStore] Failed to validate code:", e);
      return { valid: false };
    }
  }

  /**
   * Fetch referrer stats for a wallet
   */
  async function fetchStats(wallet: string): Promise<void> {
    const isInitialLoad = !lastUpdated.value;
    if (isInitialLoad) {
      loading.value = true;
    }
    error.value = null;

    try {
      const response: ReferrerStatsResponse = await BackendApi.getReferrerStats(wallet);
      referrer.value = response.referrer;
      stats.value = response.stats;
      currentWallet.value = wallet;
      lastUpdated.value = new Date();
    } catch (e: unknown) {
      // Not found is not an error - user is not a referrer
      if (e instanceof Error && e.message.includes("not found")) {
        referrer.value = null;
        stats.value = null;
      } else {
        error.value = e instanceof Error ? e.message : "Failed to fetch stats";
        console.error("[ReferralsStore] Failed to fetch stats:", e);
      }
    } finally {
      if (isInitialLoad) {
        loading.value = false;
      }
    }
  }

  /**
   * Fetch referrals list for current referrer
   */
  async function fetchReferrals(
    wallet: string,
    options?: { status?: "active" | "inactive"; limit?: number; offset?: number }
  ): Promise<void> {
    if (!wallet) return;

    try {
      const response = await BackendApi.getReferrals(wallet, options);
      referrals.value = response.referrals;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch referrals";
      console.error("[ReferralsStore] Failed to fetch referrals:", e);
    }
  }

  /**
   * Fetch rewards history
   */
  async function fetchRewards(
    wallet: string,
    options?: { status?: "pending" | "included" | "paid"; limit?: number; offset?: number }
  ): Promise<void> {
    if (!wallet) return;

    loadingRewards.value = true;
    try {
      const response = await BackendApi.getReferralRewards(wallet, options);
      rewards.value = response.rewards;
      rewardsTotal.value = response.total;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch rewards";
      console.error("[ReferralsStore] Failed to fetch rewards:", e);
    } finally {
      loadingRewards.value = false;
    }
  }

  /**
   * Fetch payouts history
   */
  async function fetchPayouts(
    wallet: string,
    options?: { status?: "pending" | "submitted" | "confirmed" | "failed"; limit?: number; offset?: number }
  ): Promise<void> {
    if (!wallet) return;

    loadingPayouts.value = true;
    try {
      const response = await BackendApi.getReferralPayouts(wallet, options);
      payouts.value = response.payouts;
      payoutsTotal.value = response.total;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch payouts";
      console.error("[ReferralsStore] Failed to fetch payouts:", e);
    } finally {
      loadingPayouts.value = false;
    }
  }

  /**
   * Register current wallet as a referrer
   */
  async function register(wallet: string): Promise<RegisterReferrerResponse | null> {
    loading.value = true;
    error.value = null;

    try {
      const response = await BackendApi.registerAsReferrer(wallet);

      // Update local state
      referrer.value = {
        wallet_address: response.wallet_address,
        referral_code: response.referral_code,
        tier: response.tier,
        status: "active",
        created_at: response.created_at
      };

      // Initialize empty stats for new referrer
      if (!response.already_registered) {
        stats.value = {
          total_referrals: 0,
          active_referrals: 0,
          total_rewards_earned: "0",
          total_rewards_paid: "0",
          pending_rewards: "0",
          rewards_denom: "unls",
          bonus_rewards_earned: 0,
          bonus_rewards_paid: 0,
          total_bonus_amount_earned: "0",
          total_bonus_amount_paid: "0"
        };
      }

      currentWallet.value = wallet;
      lastUpdated.value = new Date();

      return response;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to register";
      console.error("[ReferralsStore] Failed to register:", e);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Assign a referral (link referred wallet to referrer via code)
   */
  async function assignReferral(referralCode: string, referredWallet: string): Promise<AssignReferralResponse | null> {
    try {
      const response = await BackendApi.assignReferral(referralCode, referredWallet);
      return response;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to assign referral";
      console.error("[ReferralsStore] Failed to assign referral:", e);
      return null;
    }
  }

  /**
   * Initialize the store for a wallet
   */
  async function initialize(wallet: string): Promise<void> {
    // Skip if already loaded for this wallet
    if (currentWallet.value === wallet && referrer.value !== null) {
      return;
    }

    currentWallet.value = wallet;
    await fetchStats(wallet);

    if (referrer.value) {
      fetchReferrals(wallet).catch((e) => {
        console.error("[ReferralsStore] Failed to fetch referrals:", e);
      });
    }
  }

  /**
   * Cleanup state when wallet disconnects
   */
  function cleanup(): void {
    referrer.value = null;
    stats.value = null;
    referrals.value = [];
    rewards.value = [];
    payouts.value = [];
    rewardsTotal.value = 0;
    payoutsTotal.value = 0;
    error.value = null;
    lastUpdated.value = null;
    currentWallet.value = null;
  }

  /**
   * Refresh data for current wallet
   */
  async function refresh(): Promise<void> {
    if (!currentWallet.value) return;

    await fetchStats(currentWallet.value);

    if (referrer.value) {
      await fetchReferrals(currentWallet.value);
    }
  }

  return {
    // State
    referrer,
    stats,
    referrals,
    rewards,
    payouts,
    rewardsTotal,
    payoutsTotal,
    loading,
    loadingRewards,
    loadingPayouts,
    error,
    lastUpdated,
    currentWallet,

    // Computed
    isReferrer,
    referralCode,
    tier,
    isActive,
    totalReferrals,
    activeReferrals,
    pendingRewards,
    totalRewardsEarned,
    rewardsDenom,
    bonusRewardsEarned,
    referralLink,

    // Methods
    validateCode,
    fetchStats,
    fetchReferrals,
    fetchRewards,
    fetchPayouts,
    register,
    assignReferral,
    initialize,
    cleanup,
    refresh
  };
});
