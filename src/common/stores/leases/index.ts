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
import { LeaseInfoSchema } from "@/common/api/schemas";
import type { ZodType } from "zod";

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
  liquidated: 4,
  open_failed: 4
};

/**
 * Keys the WebSocket lease monitor owns and may write onto an existing record —
 * exactly the mutable field set of its payload (`start_lease_monitor_task` in
 * backend/src/handlers/websocket.rs); `address`/`protocol` are identity, not
 * merged. Contract: a new WS payload field requires an explicit entry here, and
 * a null/undefined value is never applied — the monitor serializes Rust `None`
 * as JSON `null` (it hardcodes `pnl: None` on every arm and `amount: None` on
 * opening/terminal arms), and REST stays authoritative for those. A blanket
 * spread would clobber the REST-computed pnl/amount with null on a routine tick.
 */
const WS_LEASE_MONITOR_KEYS = [
  "status",
  "amount",
  "debt",
  "interest",
  "liquidation_price",
  "pnl",
  "close_policy",
  "in_progress",
  "reason"
] as const satisfies readonly (keyof LeaseInfo)[];

function applyWsMonitorField<K extends keyof LeaseInfo>(target: LeaseInfo, source: Partial<LeaseInfo>, key: K): void {
  const value = source[key];
  if (value !== null && value !== undefined) {
    target[key] = value;
  }
}

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

  // Leases that failed to open (v10 `open_failed`). Kept separate from `leases`
  // so a REST reconciliation that empties the enumeration cannot erase a recorded
  // failure — the leaser removes an open_failed lease atomically, so it never
  // reappears in `/api/leases` and the WS monitor never delivers its terminal tick.
  const failedOpens = ref<Array<{ address: string; reason: string }>>([]);

  function recordFailedOpen(address: string, reason: string): void {
    if (!failedOpens.value.some((f) => f.address === address)) {
      failedOpens.value.push({ address, reason });
    }
  }

  function dismissFailedOpen(address: string): void {
    failedOpens.value = failedOpens.value.filter((f) => f.address !== address);
  }

  // ============================================================================
  // Computed Properties
  // ============================================================================

  const hasLeases = computed(() => leases.value.length > 0);
  const leaseCount = computed(() => leases.value.length);

  const openLeases = computed(() => leases.value.filter((l) => l.status === "opened" || l.status === "opening"));

  const closedLeases = computed(() =>
    leases.value.filter(
      (l) =>
        l.status === "closed" ||
        l.status === "closing" ||
        l.status === "liquidated" ||
        l.status === "paid_off" ||
        l.status === "open_failed"
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
      // Snapshot the opening leases before reconciliation so we can detect any that
      // vanished from the enumeration this cycle (candidate open_failed transitions).
      const openingBefore = leases.value.filter((l) => l.status === "opening").map((l) => l.address);

      const freshLeases = await BackendApi.getLeases(owner.value);
      const freshAddresses = new Set(freshLeases.map((l) => l.address));

      // Preserve transitional leases (opening/closing) that the backend
      // hasn't indexed yet to avoid momentary flicker in the UI.
      // Note: only preserve genuine transitional statuses, NOT opened leases
      // with optimistic in_progress — those should be cleared when the
      // backend stops returning them (lease reached terminal state).
      const preservedLeases = leases.value.filter(
        (existing) =>
          !freshAddresses.has(existing.address) && (existing.status === "opening" || existing.status === "closing")
      );

      // Don't let stale HTTP data regress leases whose status the WebSocket
      // has already advanced — keep the cached version when it's ahead.
      // Also preserve optimistic in_progress when the backend hasn't caught up yet.
      const mergedFresh = freshLeases.map((fresh) => {
        const cached = leaseDetails.value.get(fresh.address);
        if (!cached) return fresh;
        if ((STATUS_ORDER[fresh.status] ?? 0) < (STATUS_ORDER[cached.status] ?? 0)) {
          return cached;
        }
        // Preserve optimistic in_progress when backend returns same status without it
        if (cached.in_progress && !fresh.in_progress && fresh.status === cached.status) {
          return { ...fresh, in_progress: cached.in_progress };
        }
        return fresh;
      });

      leases.value = [...mergedFresh, ...preservedLeases];
      lastUpdated.value = new Date();

      // Update cache
      leases.value.forEach((lease) => {
        leaseDetails.value.set(lease.address, lease);
      });

      // Vanish-detection: an opening lease that dropped out of the enumeration may
      // have entered open_failed (removed atomically from the leaser, so it never
      // returns in /api/leases and the WS monitor never delivers the tick). Probe
      // each such address once via the direct lease query; only a confirmed
      // open_failed is recorded. A probe error surfaces through fetchLeaseDetails'
      // existing error path and records nothing — never fabricate a failure.
      const toProbe = openingBefore.filter(
        (address) => !freshAddresses.has(address) && !failedOpens.value.some((f) => f.address === address)
      );
      const probes = await Promise.allSettled(
        toProbe.map(async (address) => ({ address, lease: await fetchLeaseDetails(address) }))
      );
      for (const result of probes) {
        if (result.status === "fulfilled" && result.value.lease?.status === "open_failed") {
          recordFailedOpen(result.value.address, result.value.lease.reason ?? "");
        }
      }
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

      // Update in the main list, or add if not yet present
      const index = leases.value.findIndex((l) => l.address === address);
      if (index !== -1) {
        leases.value[index] = lease;
      } else if (owner.value) {
        leases.value.push(lease);
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
   * Optimistically mark a lease as having an in-progress operation.
   * Called right after broadcastTx so the UI updates immediately
   * (e.g. shows "Closing...") without waiting for the backend.
   */
  function markLeaseInProgress(address: string, operation: "close" | "repayment"): void {
    const inProgress: LeaseInfo["in_progress"] = operation === "close" ? { close: {} } : { repayment: {} };

    const index = leases.value.findIndex((l) => l.address === address);
    const current = leases.value[index];
    if (current === undefined) {
      return;
    }
    const updated = { ...current, in_progress: inProgress };
    leases.value[index] = updated;
    leaseDetails.value.set(address, updated);
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
        const existing = leaseDetails.value.get(wsLease.address);

        // Don't let a stale WebSocket event regress a lease whose status
        // has already advanced (same guard as fetchLeaseDetails).
        if (existing && (STATUS_ORDER[wsLease.status] ?? 0) < (STATUS_ORDER[existing.status] ?? 0)) {
          return;
        }

        let merged: LeaseInfo;
        if (existing) {
          // Existing record: apply only the monitor-owned keys, and only when the
          // incoming value is non-null — REST-computed/ETL-only fields survive, and
          // the monitor's null pnl/amount can no longer overwrite them. The existing
          // record was already validated. (See WS_LEASE_MONITOR_KEYS.)
          merged = { ...existing };
          for (const key of WS_LEASE_MONITOR_KEYS) {
            applyWsMonitorField(merged, wsLease, key);
          }
        } else {
          // No prior record: a brand-new lease must arrive as a complete LeaseInfo
          // (the same shape the REST path validates) before it reaches the money
          // path. A malformed payload is dropped, not crashing the subscription.
          const parsed = (LeaseInfoSchema as ZodType<LeaseInfo>).safeParse(wsLease);
          if (!parsed.success) {
            const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
            console.error(`[LeasesStore] Discarding malformed WebSocket lease payload (invalid: ${fields})`);
            return;
          }
          merged = parsed.data;
        }

        // Update in main list, or add if not yet present
        const index = leases.value.findIndex((l) => l.address === merged.address);
        if (index !== -1) {
          leases.value[index] = merged;
        } else {
          leases.value.push(merged);
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
      failedOpens.value = [];
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
    failedOpens,

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
    markLeaseInProgress,
    dismissFailedOpen,
    setOwner,
    cleanup,
    refresh
  };
});
