import { INTERCOM_URL, INTERCOM_API } from "@/config/global";
import { boot, Intercom as messenger, shutdown, update } from "@intercom/messenger-js-sdk";

/**
 * Intercom user data attributes
 * Using snake_case to match Intercom conventions
 */
export interface IntercomUserData {
  // Wallet info
  wallet_type?: string; // "keplr" | "leap" | "ledger" | "walletconnect" | "metamask" | "phantom" | "solflare"

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

  // Timestamps
  first_seen_at?: number;
  last_activity_at?: number;

  // Support tools
  positions_dashboard_url?: string;
}

/**
 * Centralized Intercom Service
 *
 * Handles all Intercom messenger interactions with:
 * - Proper JWT authentication on every boot
 * - Debounced updates to prevent excessive API calls
 * - Standardized attribute naming (snake_case)
 * - Centralized data management
 */
class IntercomServiceClass {
  private loaded = false;
  private currentWallet: string | null = null;
  private currentWalletType: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingData: Partial<IntercomUserData> = {};

  /**
   * Initialize Intercom for a user
   * Always fetches a fresh JWT for security
   */
  async load(wallet: string, walletType?: string): Promise<boolean> {
    try {
      const data = await this.fetchToken(wallet, walletType);
      this.currentWallet = wallet;
      this.currentWalletType = walletType || null;

      const baseData = {
        app_id: INTERCOM_API,
        api_base: "https://api-iam.intercom.io",
        user_id: wallet,
        intercom_user_jwt: data.token,
        positions_dashboard_url: this.buildDashboardUrl(wallet),
        ...(walletType && { wallet_type: walletType })
      };

      if (this.loaded) {
        // Already initialized - use boot with fresh JWT
        boot(baseData);
      } else {
        // First time - initialize messenger
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
   * Queue an update to user attributes
   * Updates are debounced to prevent excessive API calls
   */
  queueUpdate(data: Partial<IntercomUserData>): void {
    if (!this.loaded) {
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
   * Immediately send all pending updates
   */
  flushUpdates(): void {
    if (!this.loaded || Object.keys(this.pendingData).length === 0) {
      return;
    }

    update(this.pendingData);
    this.pendingData = {};

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Update user attributes immediately (no debounce)
   */
  updateNow(data: Partial<IntercomUserData>): void {
    if (!this.loaded) {
      return;
    }

    update(data);
  }

  /**
   * Update positions data (leases)
   */
  updatePositions(data: {
    count: number;
    valueUsd: string;
    debtUsd: string;
    unrealizedPnlUsd: string;
  }): void {
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
  updateStaking(data: {
    delegatedNls: string;
    delegatedUsd: string;
    validatorsCount: number;
  }): void {
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
   * Returns a promise that resolves after shutdown completes
   */
  async disconnect(): Promise<void> {
    // Flush any pending updates first
    this.flushUpdates();

    shutdown();
    this.loaded = false;
    this.currentWallet = null;
    this.currentWalletType = null;
    this.pendingData = {};

    // Small delay to ensure shutdown completes before any new boot
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
   * Fetch JWT token from backend
   */
  private async fetchToken(wallet: string, walletType?: string): Promise<{ token: string }> {
    const body: { wallet: string; wallet_type?: string } = { wallet };
    if (walletType) {
      body.wallet_type = walletType;
    }

    const response = await fetch(INTERCOM_URL, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Intercom token: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Build Grafana dashboard URL for support
   */
  private buildDashboardUrl(wallet: string): string {
    return `https://grafana9.nolus.network/d/ea14ddcc-73ed-4810-89be-fb5e035edee51/wallet-checker?orgId=1&var-walletAddress=${wallet}`;
  }
}

// Export singleton instance
export const IntercomService = new IntercomServiceClass();


