/**
 * Stats Store - Global protocol statistics
 *
 * Provides centralized management of protocol-wide statistics.
 * Data is global (no user address needed). Browser HTTP cache handles caching.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { BackendApi } from "@/common/api";
import type { IObjectKeys } from "@/common/types";

// Types for stats data
export interface StatsOverview {
  tvl: string;
  txVolume: string;
  buybackTotal: string;
  realizedPnlStats: string;
  revenue: string;
}

export interface LoansStats {
  openPositionValue: IObjectKeys | null;
  openInterest: IObjectKeys | null;
}

export interface MonthlyLease {
  month: string;
  count: number;
  [key: string]: unknown;
}

// Interfaces (unlike object literals) carry no implicit index signature, so a
// typed API response is not directly assignable to IObjectKeys. The mapped
// type restores the implicit index signature without copying the value.
function toIndexed<T extends object>(value: T | null): { [K in keyof T]: T[K] } | null {
  return value;
}

// The ETL passthrough endpoints behind these fetches return raw arrays at
// runtime; the declared response types in api/types/etl.ts describe a wrapper
// object that the wire format does not actually use.
function isMonthlyLeaseArray(value: unknown): value is MonthlyLease[] {
  return Array.isArray(value);
}

function isIndexedArray(value: unknown): value is IObjectKeys[] {
  return Array.isArray(value);
}

export const useStatsStore = defineStore("stats", () => {
  // ==========================================================================
  // State
  // ==========================================================================

  // Overview batch data
  const overview = ref<StatsOverview>({
    tvl: "0",
    txVolume: "0",
    buybackTotal: "0",
    realizedPnlStats: "0",
    revenue: "0"
  });

  // Loans batch data
  const loansStats = ref<LoansStats>({
    openPositionValue: null,
    openInterest: null
  });

  // Chart data
  const leasedAssets = ref<IObjectKeys | null>(null);
  const monthlyLeases = ref<MonthlyLease[]>([]);
  const supplyBorrowHistory = ref<IObjectKeys[]>([]);

  // Loading states
  const overviewLoading = ref(false);
  const loansStatsLoading = ref(false);
  const leasedAssetsLoading = ref(false);
  const monthlyLeasesLoading = ref(false);
  const supplyBorrowLoading = ref(false);

  // Error state
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  const initialized = ref(false);

  // ==========================================================================
  // Computed
  // ==========================================================================

  const isLoading = computed(
    () =>
      overviewLoading.value ||
      loansStatsLoading.value ||
      leasedAssetsLoading.value ||
      monthlyLeasesLoading.value ||
      supplyBorrowLoading.value
  );

  const hasOverviewData = computed(() => overview.value.tvl !== "0");
  const hasLoansStats = computed(() => loansStats.value.openPositionValue !== null);

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * Fetch overview stats (TVL, tx volume, buyback, realized PnL, revenue)
   */
  async function fetchOverview(): Promise<void> {
    const isInitialLoad = !lastUpdated.value;
    if (isInitialLoad) {
      overviewLoading.value = true;
    }
    error.value = null;

    try {
      const data = await BackendApi.getStatsOverview();

      // The wire payload carries `amount` (the declared RealizedPnlStatsResponse
      // type does not), so the field is read through a runtime narrowing chain.
      const pnlStats = data.realized_pnl_stats;
      const realizedPnlAmount =
        pnlStats !== null && "amount" in pnlStats && typeof pnlStats.amount === "string" ? pnlStats.amount : "0";

      overview.value = {
        tvl: data.tvl?.total_value_locked ?? "0",
        txVolume: data.tx_volume?.total_tx_value ?? "0",
        buybackTotal: data.buyback_total?.buyback_total ?? "0",
        realizedPnlStats: realizedPnlAmount,
        revenue: data.revenue?.revenue ?? "0"
      };

      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch overview stats";
      console.error("[StatsStore] Failed to fetch overview:", e);
      throw e;
    } finally {
      if (isInitialLoad) {
        overviewLoading.value = false;
      }
    }
  }

  /**
   * Fetch loans stats (open position value, open interest)
   */
  async function fetchLoansStats(): Promise<void> {
    const isInitialLoad = !lastUpdated.value;
    if (isInitialLoad) {
      loansStatsLoading.value = true;
    }
    error.value = null;

    try {
      const data = await BackendApi.getLoansStats();

      loansStats.value = {
        openPositionValue: toIndexed(data.open_position_value),
        openInterest: toIndexed(data.open_interest)
      };

      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch loans stats";
      console.error("[StatsStore] Failed to fetch loans stats:", e);
      throw e;
    } finally {
      if (isInitialLoad) {
        loansStatsLoading.value = false;
      }
    }
  }

  /**
   * Fetch leased assets breakdown
   */
  async function fetchLeasedAssets(): Promise<void> {
    const isInitialLoad = !lastUpdated.value;
    if (isInitialLoad) {
      leasedAssetsLoading.value = true;
    }
    error.value = null;

    try {
      leasedAssets.value = toIndexed(await BackendApi.getLeasedAssets());
      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch leased assets";
      console.error("[StatsStore] Failed to fetch leased assets:", e);
      throw e;
    } finally {
      if (isInitialLoad) {
        leasedAssetsLoading.value = false;
      }
    }
  }

  /**
   * Fetch monthly leases data
   */
  async function fetchMonthlyLeases(period: string = ""): Promise<void> {
    monthlyLeasesLoading.value = true;
    error.value = null;

    try {
      const data = await BackendApi.getMonthlyLeases(period || undefined);
      if (isMonthlyLeaseArray(data)) {
        monthlyLeases.value = data;
      } else {
        console.error("[StatsStore] Dropping monthly-leases payload: expected an array");
        monthlyLeases.value = [];
      }
      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch monthly leases";
      console.error("[StatsStore] Failed to fetch monthly leases:", e);
      throw e;
    } finally {
      monthlyLeasesLoading.value = false;
    }
  }

  /**
   * Fetch supply/borrow history time series
   */
  async function fetchSupplyBorrowHistory(period: string = ""): Promise<void> {
    supplyBorrowLoading.value = true;
    error.value = null;

    try {
      const data = await BackendApi.getSupplyBorrowHistory(period || undefined);
      if (isIndexedArray(data)) {
        supplyBorrowHistory.value = data;
      } else {
        console.error("[StatsStore] Dropping supply/borrow history payload: expected an array");
        supplyBorrowHistory.value = [];
      }
      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch supply/borrow history";
      console.error("[StatsStore] Failed to fetch supply/borrow history:", e);
      throw e;
    } finally {
      supplyBorrowLoading.value = false;
    }
  }

  /**
   * Initialize the store - fetch fresh data
   */
  async function initialize(): Promise<void> {
    if (initialized.value) {
      return;
    }

    await Promise.all([fetchOverview(), fetchLoansStats(), fetchLeasedAssets()]);
    initialized.value = true;
  }

  /**
   * Refresh all stats data
   */
  async function refresh(): Promise<void> {
    await Promise.all([fetchOverview(), fetchLoansStats(), fetchLeasedAssets()]);
  }

  /**
   * Cleanup - reset state
   */
  function cleanup(): void {
    initialized.value = false;
    overview.value = {
      tvl: "0",
      txVolume: "0",
      buybackTotal: "0",
      realizedPnlStats: "0",
      revenue: "0"
    };
    loansStats.value = {
      openPositionValue: null,
      openInterest: null
    };
    leasedAssets.value = null;
    monthlyLeases.value = [];
    supplyBorrowHistory.value = [];
    error.value = null;
    lastUpdated.value = null;
  }

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    overview,
    loansStats,
    leasedAssets,
    monthlyLeases,
    supplyBorrowHistory,
    overviewLoading,
    loansStatsLoading,
    leasedAssetsLoading,
    monthlyLeasesLoading,
    supplyBorrowLoading,
    error,
    lastUpdated,
    initialized,

    // Computed
    isLoading,
    hasOverviewData,
    hasLoansStats,

    // Actions
    fetchOverview,
    fetchLoansStats,
    fetchLeasedAssets,
    fetchMonthlyLeases,
    fetchSupplyBorrowHistory,
    initialize,
    refresh,
    cleanup
  };
});
