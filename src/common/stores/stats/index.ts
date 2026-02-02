/**
 * Stats Store - Global protocol statistics
 *
 * Provides centralized management of protocol-wide statistics.
 * Data is global (no user address needed) and cached in localStorage.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { EtlApi } from "@/common/utils";
import type { IObjectKeys } from "@/common/types";

// Cache configuration
const STORAGE_KEY = "nolus_stats_cache";
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

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

  const isLoading = computed(() => 
    overviewLoading.value || 
    loansStatsLoading.value || 
    leasedAssetsLoading.value ||
    monthlyLeasesLoading.value ||
    supplyBorrowLoading.value
  );

  const hasOverviewData = computed(() => overview.value.tvl !== "0");
  const hasLoansStats = computed(() => loansStats.value.openPositionValue !== null);

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  function loadFromCache(): boolean {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) return false;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      if (age < CACHE_MAX_AGE_MS && data) {
        if (data.overview) overview.value = data.overview;
        if (data.loansStats) loansStats.value = data.loansStats;
        if (data.leasedAssets) leasedAssets.value = data.leasedAssets;
        if (data.monthlyLeases) monthlyLeases.value = data.monthlyLeases;
        lastUpdated.value = new Date(timestamp);
        return true;
      }
      return false;
    } catch (e) {
      console.warn("[StatsStore] Failed to load cache:", e);
      return false;
    }
  }

  function saveToCache(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        data: {
          overview: overview.value,
          loansStats: loansStats.value,
          leasedAssets: leasedAssets.value,
          monthlyLeases: monthlyLeases.value
        },
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn("[StatsStore] Failed to save cache:", e);
    }
  }

  // ==========================================================================
  // Actions
  // ==========================================================================

  /**
   * Fetch overview stats (TVL, tx volume, buyback, realized PnL, revenue)
   */
  async function fetchOverview(): Promise<void> {
    overviewLoading.value = true;
    error.value = null;

    try {
      const data = await EtlApi.fetchStatsOverviewBatch();

      overview.value = {
        tvl: data.tvl?.total_value_locked ?? "0",
        txVolume: data.tx_volume?.total_tx_value ?? "0",
        buybackTotal: data.buyback_total?.buyback_total ?? "0",
        realizedPnlStats: data.realized_pnl_stats?.amount ?? "0",
        revenue: data.revenue?.revenue ?? "0"
      };

      lastUpdated.value = new Date();
      saveToCache();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch overview stats";
      console.error("[StatsStore] Failed to fetch overview:", e);
    } finally {
      overviewLoading.value = false;
    }
  }

  /**
   * Fetch loans stats (open position value, open interest)
   */
  async function fetchLoansStats(): Promise<void> {
    loansStatsLoading.value = true;
    error.value = null;

    try {
      const data = await EtlApi.fetchLoansStatsBatch();

      loansStats.value = {
        openPositionValue: data.open_position_value,
        openInterest: data.open_interest
      };

      lastUpdated.value = new Date();
      saveToCache();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch loans stats";
      console.error("[StatsStore] Failed to fetch loans stats:", e);
    } finally {
      loansStatsLoading.value = false;
    }
  }

  /**
   * Fetch leased assets breakdown
   */
  async function fetchLeasedAssets(): Promise<void> {
    leasedAssetsLoading.value = true;
    error.value = null;

    try {
      leasedAssets.value = await EtlApi.fetchLeasedAssets();
      lastUpdated.value = new Date();
      saveToCache();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch leased assets";
      console.error("[StatsStore] Failed to fetch leased assets:", e);
    } finally {
      leasedAssetsLoading.value = false;
    }
  }

  /**
   * Fetch monthly leases data
   */
  async function fetchMonthlyLeases(): Promise<void> {
    monthlyLeasesLoading.value = true;
    error.value = null;

    try {
      monthlyLeases.value = await EtlApi.fetchLeaseMonthly();
      lastUpdated.value = new Date();
      saveToCache();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch monthly leases";
      console.error("[StatsStore] Failed to fetch monthly leases:", e);
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
      supplyBorrowHistory.value = await EtlApi.fetchTimeSeries(period);
      lastUpdated.value = new Date();
      // Note: Don't cache time series as it depends on period parameter
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch supply/borrow history";
      console.error("[StatsStore] Failed to fetch supply/borrow history:", e);
    } finally {
      supplyBorrowLoading.value = false;
    }
  }

  /**
   * Initialize the store - load from cache and fetch fresh data
   */
  async function initialize(): Promise<void> {
    if (initialized.value) {
      return;
    }

    const hadCache = loadFromCache();

    if (hadCache) {
      // Have cached data - fetch in background
      initialized.value = true;
      Promise.all([
        fetchOverview(),
        fetchLoansStats(),
        fetchLeasedAssets(),
        fetchMonthlyLeases()
      ]).catch(e => console.error("[StatsStore] Background refresh failed:", e));
    } else {
      // No cache - wait for fetch
      await Promise.all([
        fetchOverview(),
        fetchLoansStats(),
        fetchLeasedAssets(),
        fetchMonthlyLeases()
      ]);
      initialized.value = true;
    }
  }

  /**
   * Refresh all stats data
   */
  async function refresh(): Promise<void> {
    await Promise.all([
      fetchOverview(),
      fetchLoansStats(),
      fetchLeasedAssets(),
      fetchMonthlyLeases()
    ]);
  }

  /**
   * Cleanup - clear cache if needed
   */
  function cleanup(): void {
    // Stats are global, so we don't clear on disconnect
    // Cache will expire naturally after 5 minutes
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
