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
  type LeaseHistoryEntry
} from "@/common/api";
import { usePricesStore } from "../prices";
import { useConfigStore } from "../config";
import { useWalletWatcher } from "@/common/composables/useWalletWatcher";
import { useWebSocketLifecycle } from "@/common/composables/useWebSocketLifecycle";
import { LeaseCalculator, type LeaseDisplayData } from "@/common/utils";
import { getLpnByProtocol } from "@/common/utils/CurrencyLookup";

// Re-export LeaseDisplayData from LeaseCalculator for convenience
export type { LeaseDisplayData } from "@/common/utils";

/**
 * Status progression order — higher index means more advanced.
 * Used to prevent stale HTTP responses from regressing a lease's
 * status when the WebSocket has already delivered a fresher update.
 */
const STATUS_ORDER: Record<string, number> = {
  opening: 0,
  opened: 1,
  paid_off: 2,
  closing: 3,
  closed: 4,
  liquidated: 4
};

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

  // ============================================================================
  // Computed Properties
  // ============================================================================

  const hasLeases = computed(() => leases.value.length > 0);
  const leaseCount = computed(() => leases.value.length);

  const openLeases = computed(() => leases.value.filter((l) => l.status === "opened" || l.status === "opening"));

  const closedLeases = computed(() =>
    leases.value.filter(
      (l) => l.status === "closed" || l.status === "closing" || l.status === "liquidated" || l.status === "paid_off"
    )
  );

  /**
   * Calculate total unrealized PnL across all open leases
   */
  const totalPnl = computed(() => LeaseCalculator.calculateTotalPnl(openLeases.value));

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
    return leases.value.find((l) => l.address === address) ?? leaseDetails.value.get(address);
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
        getPriceAsNumber: (key: string) => pricesStore.getPriceAsNumber(key)
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
        getPositionType: (protocol: string) => configStore.getPositionType(protocol)
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

    const isInitialLoad = !lastUpdated.value;
    if (isInitialLoad) {
      loading.value = true;
    }
    error.value = null;

    try {
      const freshLeases = await BackendApi.getLeases(owner.value);
      const freshAddresses = new Set(freshLeases.map((l) => l.address));

      // Preserve transitional leases (opening/closing/in_progress) that the
      // backend hasn't indexed yet to avoid momentary flicker in the UI.
      const preservedLeases = leases.value.filter(
        (existing) =>
          !freshAddresses.has(existing.address) &&
          (existing.status === "opening" || existing.status === "closing" || existing.in_progress)
      );

      // Don't let stale HTTP data regress leases whose status the WebSocket
      // has already advanced — keep the cached version when it's ahead.
      const mergedFresh = freshLeases.map((fresh) => {
        const cached = leaseDetails.value.get(fresh.address);
        if (cached && (STATUS_ORDER[fresh.status] ?? 0) < (STATUS_ORDER[cached.status] ?? 0)) {
          return cached;
        }
        return fresh;
      });

      leases.value = [...mergedFresh, ...preservedLeases];
      lastUpdated.value = new Date();

      // Update cache
      leases.value.forEach((lease) => {
        leaseDetails.value.set(lease.address, lease);
      });
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch leases";
      console.error("[LeasesStore] Failed to fetch leases:", e);
    } finally {
      if (isInitialLoad) {
        loading.value = false;
      }
    }
  }

  /**
   * Fetch details for a specific lease
   */
  async function fetchLeaseDetails(address: string, protocol?: string): Promise<LeaseInfo | null> {
    try {
      // Resolve protocol from cache if not provided — the backend defaults
      // to a Long protocol when none is supplied, which is wrong for Shorts.
      const resolvedProtocol = protocol || getLease(address)?.protocol;
      const lease = await BackendApi.getLease(address, resolvedProtocol);

      // Don't let a stale HTTP response regress a lease whose status the
      // WebSocket has already advanced (e.g. "opening" → "opened").
      const existing = leaseDetails.value.get(address);
      if (existing && (STATUS_ORDER[lease.status] ?? 0) < (STATUS_ORDER[existing.status] ?? 0)) {
        return existing;
      }

      leaseDetails.value.set(address, lease);

      // Update in the main list if present
      const index = leases.value.findIndex((l) => l.address === address);
      if (index !== -1) {
        leases.value[index] = lease;
      }

      return lease;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch lease details";
      console.error("[LeasesStore] Failed to fetch lease details:", e);
      return null;
    }
  }

  /**
   * Fetch history for a specific lease
   */
  async function fetchLeaseHistory(address: string, skip?: number, limit?: number): Promise<LeaseHistoryEntry[]> {
    try {
      const history = await BackendApi.getLeaseHistory(address, skip, limit);
      leaseHistories.value.set(address, history);
      return history;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch lease history";
      console.error("[LeasesStore] Failed to fetch lease history:", e);
      return [];
    }
  }

  /**
   * Get a lease quote
   */
  async function getQuote(request: LeaseQuoteRequest): Promise<LeaseQuoteResponse> {
    return BackendApi.getLeaseQuote(request);
  }

  // WebSocket lifecycle: subscribe, fetch, unsubscribe, cleanup
  const { setAddress: setOwner, cleanup } = useWebSocketLifecycle({
    address: owner,
    subscribe: (addr) =>
      WebSocketClient.subscribeLeases(addr, (wsLease) => {
        // Merge with existing data (WebSocket sends partial data, no ETL)
        const existing = leaseDetails.value.get(wsLease.address);
        const merged = existing ? { ...existing, ...wsLease } : (wsLease as LeaseInfo);

        // Update in main list
        const index = leases.value.findIndex((l) => l.address === merged.address);
        if (index !== -1) {
          leases.value[index] = merged;
        }

        // Update cache
        leaseDetails.value.set(merged.address, merged);
        lastUpdated.value = new Date();
      }),
    fetch: fetchLeases,
    resetState: () => {
      leases.value = [];
      leaseDetails.value.clear();
      leaseHistories.value.clear();
      lastUpdated.value = null;
      error.value = null;
    }
  });

  /**
   * Refresh leases data
   */
  async function refresh(): Promise<void> {
    await fetchLeases();
  }

  // Self-register: watch wallet address changes from connectionStore.
  useWalletWatcher(setOwner, cleanup, fetchLeases);

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
    setOwner,
    cleanup,
    refresh
  };
});
