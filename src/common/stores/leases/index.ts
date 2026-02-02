/**
 * Leases Store - User leases from backend
 *
 * Uses WebSocket for real-time updates when wallet is connected.
 * Replaces direct contract queries, useLeases composable, and EtlApi calls.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { Dec } from "@keplr-wallet/unit";
import {
  BackendApi,
  WebSocketClient,
  type LeaseInfo,
  type LeaseQuoteRequest,
  type LeaseQuoteResponse,
  type LeaseHistoryEntry,
  type LeaseClosePolicy,
  type LeaseInProgress,
  type LeaseOpeningStateInfo,
  type LeaseEtlData,
  type Unsubscribe,
} from "@/common/api";
import { usePricesStore } from "../prices";
import { useConfigStore } from "../config";
import { LeaseCalculator, type LeaseDisplayData } from "@/common/utils";
import { getLpnByProtocol } from "@/common/utils/CurrencyLookup";

// Re-export LeaseDisplayData from LeaseCalculator for convenience
export type { LeaseDisplayData } from "@/common/utils";

export const useLeasesStore = defineStore("leases", () => {
  // State
  const leases = ref<LeaseInfo[]>([]);
  const owner = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  // Cache for individual lease details
  const leaseDetails = ref<Map<string, LeaseInfo>>(new Map());
  const leaseHistories = ref<Map<string, LeaseHistoryEntry[]>>(new Map());

  // WebSocket subscription handle
  let unsubscribe: Unsubscribe | null = null;

  // ============================================================================
  // Computed Properties
  // ============================================================================

  const hasLeases = computed(() => leases.value.length > 0);
  const leaseCount = computed(() => leases.value.length);

  const openLeases = computed(() =>
    leases.value.filter((l) => l.status === "opened" || l.status === "opening")
  );

  const closedLeases = computed(() =>
    leases.value.filter(
      (l) =>
        l.status === "closed" ||
        l.status === "closing" ||
        l.status === "liquidated" ||
        l.status === "paid_off"
    )
  );

  /**
   * Calculate total unrealized PnL across all open leases
   */
  const totalPnl = computed(() => LeaseCalculator.calculateTotalPnl(openLeases.value));

  /**
   * Calculate total debt across all open leases
   */
  const totalDebt = computed(() => LeaseCalculator.calculateTotalDebt(openLeases.value));

  /**
   * Calculate total collateral value across all open leases
   */
  const totalCollateralUsd = computed(() => {
    const pricesStore = usePricesStore();
    const configStore = useConfigStore();
    let total = new Dec(0);

    for (const lease of openLeases.value) {
      const ticker = lease.amount.ticker;
      const currency = configStore.currenciesData[`${ticker}@${lease.protocol}`];
      if (currency) {
        const price = pricesStore.getPriceAsNumber(currency.key);
        const amount = new Dec(lease.amount.amount, currency.decimal_digits);
        total = total.add(amount.mul(new Dec(price)));
      }
    }
    return total;
  });

  // ============================================================================
  // Getter Functions
  // ============================================================================

  /**
   * Get a lease by address
   */
  function getLease(address: string): LeaseInfo | undefined {
    return (
      leases.value.find((l) => l.address === address) ??
      leaseDetails.value.get(address)
    );
  }

  /**
   * Get lease history from cache
   */
  function getLeaseHistory(address: string): LeaseHistoryEntry[] {
    return leaseHistories.value.get(address) ?? [];
  }

  /**
   * Create a LeaseCalculator instance with store dependencies
   */
  function createLeaseCalculator(): LeaseCalculator {
    const pricesStore = usePricesStore();
    const configStore = useConfigStore();

    return new LeaseCalculator(
      // Price provider
      {
        getPriceAsNumber: (key: string) => pricesStore.getPriceAsNumber(key),
      },
      // Currency provider
      {
        getCurrency: (ticker: string, protocol: string) => {
          const currency = configStore.currenciesData[`${ticker}@${protocol}`];
          return currency ? { key: currency.key, decimal_digits: currency.decimal_digits } : undefined;
        },
        getLpnCurrency: (protocol: string) => {
          const lpn = getLpnByProtocol(protocol);
          const lpnCurrency = lpn?.key ? configStore.currenciesData[lpn.key] : null;
          return lpnCurrency ? { key: lpnCurrency.key, decimal_digits: lpnCurrency.decimal_digits } : undefined;
        },
      }
    );
  }

  /**
   * Calculate display data for a lease including computed values
   * Uses LeaseCalculator for all calculations
   */
  function getLeaseDisplayData(lease: LeaseInfo): LeaseDisplayData {
    const calculator = createLeaseCalculator();
    return calculator.calculateDisplayData(lease);
  }

  /**
   * Get all leases with computed display data
   */
  function getLeasesWithDisplayData(): LeaseDisplayData[] {
    return leases.value.map((lease) => getLeaseDisplayData(lease));
  }

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Fetch all leases for the connected owner
   */
  async function fetchLeases(): Promise<void> {
    if (!owner.value) {
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      leases.value = await BackendApi.getLeases(owner.value);
      lastUpdated.value = new Date();

      // Update cache
      leases.value.forEach((lease) => {
        leaseDetails.value.set(lease.address, lease);
      });
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch leases";
      console.error("[LeasesStore] Failed to fetch leases:", e);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Fetch details for a specific lease
   */
  async function fetchLeaseDetails(address: string, protocol?: string): Promise<LeaseInfo | null> {
    try {
      const lease = await BackendApi.getLease(address);
      leaseDetails.value.set(address, lease);

      // Update in the main list if present
      const index = leases.value.findIndex((l) => l.address === address);
      if (index !== -1) {
        leases.value[index] = lease;
      }

      return lease;
    } catch (e) {
      console.error("[LeasesStore] Failed to fetch lease details:", e);
      return null;
    }
  }

  /**
   * Fetch history for a specific lease
   */
  async function fetchLeaseHistory(
    address: string,
    skip?: number,
    limit?: number
  ): Promise<LeaseHistoryEntry[]> {
    try {
      const history = await BackendApi.getLeaseHistory(address, skip, limit);
      leaseHistories.value.set(address, history);
      return history;
    } catch (e) {
      console.error("[LeasesStore] Failed to fetch lease history:", e);
      return [];
    }
  }

  /**
   * Get a lease quote
   */
  async function getQuote(
    request: LeaseQuoteRequest
  ): Promise<LeaseQuoteResponse> {
    return BackendApi.getLeaseQuote(request);
  }

  /**
   * Subscribe to real-time lease updates via WebSocket
   */
  function subscribeToUpdates(): void {
    if (!owner.value || unsubscribe) {
      return;
    }

    unsubscribe = WebSocketClient.subscribeLeases(owner.value, (lease) => {
      // Update in main list
      const index = leases.value.findIndex((l) => l.address === lease.address);
      if (index !== -1) {
        leases.value[index] = lease;
      } else {
        leases.value.push(lease);
      }

      // Update cache
      leaseDetails.value.set(lease.address, lease);
      lastUpdated.value = new Date();
    });
  }

  /**
   * Unsubscribe from real-time updates
   */
  function unsubscribeFromUpdates(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  /**
   * Set the owner address and fetch leases
   */
  async function setOwner(newOwner: string | null): Promise<void> {
    // Cleanup previous subscription
    unsubscribeFromUpdates();

    owner.value = newOwner;
    leases.value = [];

    if (newOwner) {
      await fetchLeases();
      subscribeToUpdates();
    }
  }

  /**
   * Clear leases (on disconnect)
   */
  function clear(): void {
    unsubscribeFromUpdates();
    owner.value = null;
    leases.value = [];
    leaseDetails.value.clear();
    leaseHistories.value.clear();
    lastUpdated.value = null;
    error.value = null;
  }

  /**
   * Refresh leases data
   */
  async function refresh(): Promise<void> {
    await fetchLeases();
  }

  return {
    // State
    leases,
    owner,
    loading,
    error,
    lastUpdated,

    // Computed
    hasLeases,
    leaseCount,
    openLeases,
    closedLeases,
    totalPnl,
    totalDebt,
    totalCollateralUsd,

    // Getters
    getLease,
    getLeaseHistory,
    getLeaseDisplayData,
    getLeasesWithDisplayData,

    // Actions
    fetchLeases,
    fetchLeaseDetails,
    fetchLeaseHistory,
    getQuote,
    subscribeToUpdates,
    unsubscribeFromUpdates,
    setOwner,
    clear,
    refresh,
  };
});
