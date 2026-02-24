import { INTERCOM_API } from "@/config/global";
import { boot, Intercom as messenger, shutdown, update } from "@intercom/messenger-js-sdk";
import { BackendApi } from "@/common/api";

/**
 * Intercom user data attributes
 * Using snake_case to match Intercom conventions.
 * These are embedded in the signed JWT payload by the backend.
 */
export interface IntercomUserData {
  // Wallet info
  wallet_type?: string;

  // Portfolio summary
  total_balance_usd?: string;
  positions_count?: number;
  positions_value_usd?: string;
  positions_debt_usd?: string;
  positions_unrealized_pnl_usd?: string;

  // Earn
  earn_deposited_usd?: string;
  earn_pools_count?: number;

  // Staking
  staking_delegated_nls?: string;
  staking_delegated_usd?: string;
  staking_vested_nls?: string;
  staking_validators_count?: number;

  // Activity indicators
  has_active_leases?: boolean;
  has_earn_positions?: boolean;
  has_staking_positions?: boolean;
  is_vesting_account?: boolean;

}

/**
 * Centralized Intercom Service
 *
 * All user attributes are embedded in signed JWT tokens by the backend.
 * This prevents client-side tampering and complies with Intercom's
 * "Require verified updates" security setting.
 *
 * Flow:
 * 1. Frontend calls update methods (updatePositions, updateEarn, etc.)
 * 2. Attributes are accumulated and debounced
 * 3. A fresh JWT is requested from the backend with all attributes embedded
 * 4. The signed JWT is passed to Intercom via boot()/update()
 */
class IntercomServiceClass {
  private loaded = false;
  private currentWallet: string | null = null;
  private currentAttributes: Partial<IntercomUserData> = {};
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingData: Partial<IntercomUserData> = {};

  /**
   * Initialize Intercom for a user.
   * Fetches a signed JWT with the initial attributes embedded.
   */
  async load(wallet: string, walletType?: string): Promise<boolean> {
    try {
      this.currentWallet = wallet;
      this.currentAttributes = {
        ...(walletType && { wallet_type: walletType })
      };

      const data = await this.fetchSignedToken();

      const baseData = {
        app_id: INTERCOM_API,
        api_base: "https://api-iam.intercom.io",
        user_id: wallet,
        intercom_user_jwt: data.token
      };

      if (this.loaded) {
        boot(baseData);
      } else {
        messenger(baseData);
        this.loaded = true;
      }

      return true;
    } catch (e) {
      console.error("[IntercomService] Failed to load:", e);
      return false;
    }
  }

  /**
   * Queue an update to user attributes.
   * Updates are debounced, then a fresh signed JWT is fetched.
   */
  queueUpdate(data: Partial<IntercomUserData>): void {
    if (!this.loaded || !this.currentWallet) {
      return;
    }

    this.pendingData = { ...this.pendingData, ...data };

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushUpdates();
    }, 500);
  }

  /**
   * Immediately send all pending updates via a fresh signed JWT.
   */
  async flushUpdates(): Promise<void> {
    if (!this.loaded || !this.currentWallet || Object.keys(this.pendingData).length === 0) {
      return;
    }

    // Merge pending data into current attributes
    this.currentAttributes = { ...this.currentAttributes, ...this.pendingData };
    this.pendingData = {};

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    try {
      const data = await this.fetchSignedToken();
      update({ intercom_user_jwt: data.token });
    } catch (e) {
      console.error("[IntercomService] Failed to update:", e);
    }
  }

  /**
   * Update positions data (leases)
   */
  updatePositions(data: { count: number; valueUsd: string; debtUsd: string; unrealizedPnlUsd: string }): void {
    this.queueUpdate({
      positions_count: data.count,
      positions_value_usd: data.valueUsd,
      positions_debt_usd: data.debtUsd,
      positions_unrealized_pnl_usd: data.unrealizedPnlUsd,
      has_active_leases: data.count > 0
    });
  }

  /**
   * Update earn data
   */
  updateEarn(data: { depositedUsd: string; poolsCount: number }): void {
    this.queueUpdate({
      earn_deposited_usd: data.depositedUsd,
      earn_pools_count: data.poolsCount,
      has_earn_positions: data.poolsCount > 0
    });
  }

  /**
   * Update staking data
   */
  updateStaking(data: { delegatedNls: string; delegatedUsd: string; validatorsCount: number }): void {
    this.queueUpdate({
      staking_delegated_nls: data.delegatedNls,
      staking_delegated_usd: data.delegatedUsd,
      staking_validators_count: data.validatorsCount,
      has_staking_positions: data.validatorsCount > 0
    });
  }

  /**
   * Update vesting data
   */
  updateVesting(data: { vestedNls: string; isVestingAccount: boolean }): void {
    this.queueUpdate({
      staking_vested_nls: data.vestedNls,
      is_vesting_account: data.isVestingAccount
    });
  }

  /**
   * Update total balance
   */
  updateBalance(totalBalanceUsd: string): void {
    this.queueUpdate({
      total_balance_usd: totalBalanceUsd
    });
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    await this.flushUpdates();

    shutdown();
    this.loaded = false;
    this.currentWallet = null;
    this.currentAttributes = {};
    this.pendingData = {};

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Check if Intercom is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get current wallet address
   */
  getCurrentWallet(): string | null {
    return this.currentWallet;
  }

  /**
   * Fetch a signed JWT from the backend with all current attributes embedded.
   */
  private async fetchSignedToken(): Promise<{ token: string }> {
    const allAttributes = { ...this.currentAttributes, ...this.pendingData };
    return BackendApi.getIntercomToken(this.currentWallet!, allAttributes);
  }

}

// Export singleton instance
export const IntercomService = new IntercomServiceClass();
