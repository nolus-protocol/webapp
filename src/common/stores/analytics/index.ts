/**
 * Analytics Store - User-specific analytics and chart data
 *
 * Provides centralized management of user analytics:
 * - Dashboard metrics (earnings, realized PnL, position/debt value)
 * - History stats
 * - Chart data (PnL over time, price series)
 *
 * Data is user-specific and cleared on disconnect.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { BackendApi } from "@/common/api";
import type { IObjectKeys } from "@/common/types";
import type { PriceDataPoint, PnlDataPoint, LeaseClosingEntry } from "@/common/api/types";

// Types
export interface UserDashboardData {
  earnings: IObjectKeys | null;
  realizedPnl: IObjectKeys | null;
  positionDebtValue: IObjectKeys | null;
}

export interface UserHistoryData {
  historyStats: IObjectKeys | null;
  realizedPnlData: IObjectKeys[] | null;
}

export const useAnalyticsStore = defineStore("analytics", () => {
  // ==========================================================================
  // State
  // ==========================================================================

  const address = ref<string | null>(null);

  // User dashboard batch data
  const dashboardData = ref<UserDashboardData>({
    earnings: null,
    realizedPnl: null,
    positionDebtValue: null
  });

  // User history batch data
  const historyData = ref<UserHistoryData>({
    historyStats: null,
    realizedPnlData: null
  });

  // PnL over time (user-specific chart)
  const pnlOverTime = ref<PnlDataPoint[]>([]);
  const pnlOverTimeInterval = ref<string>("");

  // Price series cache (keyed by "key:protocol:interval")
  const priceSeriesCache = ref<Map<string, PriceDataPoint[]>>(new Map());

  // Realized PnL list (paginated)
  const realizedPnlList = ref<LeaseClosingEntry[]>([]);
  const realizedPnlTotal = ref<number>(0);

  // Loading states
  const dashboardLoading = ref(false);
  const historyLoading = ref(false);
  const pnlOverTimeLoading = ref(false);
  const priceSeriesLoading = ref(false);
  const realizedPnlListLoading = ref(false);

  // Error state
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  const initialized = ref(false);

  // ==========================================================================
  // Computed
  // ==========================================================================

  const isConnected = computed(() => address.value !== null);

  const hasEarnings = computed(() => dashboardData.value.earnings !== null);

  const hasHistoryStats = computed(() => historyData.value.historyStats !== null);

  const earnings = computed(() => dashboardData.value.earnings);

  const realizedPnl = computed(() => dashboardData.value.realizedPnl);

  const positionDebtValue = computed(() => dashboardData.value.positionDebtValue);

  const historyStats = computed(() => historyData.value.historyStats);

  const realizedPnlData = computed(() => historyData.value.realizedPnlData);

  // ==========================================================================
  // Actions - Dashboard Data
  // ==========================================================================

  /**
   * Fetch user dashboard data (earnings, realized PnL, position/debt value)
   */
  async function fetchDashboardData(): Promise<void> {
    if (!address.value) return;

    dashboardLoading.value = true;
    error.value = null;

    try {
      const data = await BackendApi.getUserDashboard(address.value);

      dashboardData.value = {
        earnings: data.earnings,
        realizedPnl: data.realized_pnl,
        positionDebtValue: data.position_debt_value
      };

      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch dashboard data";
      console.error("[AnalyticsStore] Failed to fetch dashboard data:", e);
      throw e;
    } finally {
      dashboardLoading.value = false;
    }
  }

  /**
   * Fetch just earnings (for components that only need this)
   */
  async function fetchEarnings(): Promise<void> {
    if (!address.value) return;

    try {
      const earnings = await BackendApi.getEarnings(address.value);
      dashboardData.value.earnings = earnings;
    } catch (e) {
      console.error("[AnalyticsStore] Failed to fetch earnings:", e);
      throw e;
    }
  }

  /**
   * Fetch position/debt value history
   */
  async function fetchPositionDebtValue(): Promise<void> {
    if (!address.value) return;

    try {
      const data = await BackendApi.getPositionDebtValue(address.value);
      dashboardData.value.positionDebtValue = data;
    } catch (e) {
      console.error("[AnalyticsStore] Failed to fetch position/debt value:", e);
      throw e;
    }
  }

  // ==========================================================================
  // Actions - History Data
  // ==========================================================================

  /**
   * Fetch user history data (history stats, realized PnL data)
   */
  async function fetchHistoryData(): Promise<void> {
    if (!address.value) return;

    historyLoading.value = true;
    error.value = null;

    try {
      const data = await BackendApi.getUserHistory(address.value);

      historyData.value = {
        historyStats: data.history_stats,
        realizedPnlData: data.realized_pnl_data
      };

      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch history data";
      console.error("[AnalyticsStore] Failed to fetch history data:", e);
      throw e;
    } finally {
      historyLoading.value = false;
    }
  }

  /**
   * Fetch history stats only
   */
  async function fetchHistoryStats(): Promise<void> {
    if (!address.value) return;

    try {
      const stats = await BackendApi.getHistoryStats(address.value);
      historyData.value.historyStats = stats;
    } catch (e) {
      console.error("[AnalyticsStore] Failed to fetch history stats:", e);
      throw e;
    }
  }

  /**
   * Fetch realized PnL for user
   */
  async function fetchRealizedPnl(): Promise<void> {
    if (!address.value) return;

    try {
      const data = await BackendApi.getRealizedPnl(address.value);
      dashboardData.value.realizedPnl = data;
    } catch (e) {
      console.error("[AnalyticsStore] Failed to fetch realized PnL:", e);
      throw e;
    }
  }

  /**
   * Fetch realized PnL data details
   */
  async function fetchRealizedPnlData(): Promise<void> {
    if (!address.value) return;

    try {
      const data = await BackendApi.getRealizedPnlData(address.value);
      historyData.value.realizedPnlData = data;
    } catch (e) {
      console.error("[AnalyticsStore] Failed to fetch realized PnL data:", e);
      throw e;
    }
  }

  /**
   * Fetch paginated PnL list (for PnlLog component)
   */
  async function fetchPnlList(skip: number = 0, limit: number = 10): Promise<LeaseClosingEntry[]> {
    if (!address.value) return [];

    realizedPnlListLoading.value = true;

    try {
      const response = await BackendApi.getPnlLog(address.value, skip, limit);
      
      if (skip === 0) {
        realizedPnlList.value = response.data;
      } else {
        realizedPnlList.value = [...realizedPnlList.value, ...response.data];
      }
      
      realizedPnlTotal.value = response.total;
      return response.data;
    } catch (e) {
      console.error("[AnalyticsStore] Failed to fetch PnL list:", e);
      throw e;
    } finally {
      realizedPnlListLoading.value = false;
    }
  }

  // ==========================================================================
  // Actions - Chart Data
  // ==========================================================================

  /**
   * Fetch PnL over time chart data
   */
  async function fetchPnlOverTime(interval: string = "1d"): Promise<void> {
    if (!address.value) return;

    pnlOverTimeLoading.value = true;
    error.value = null;

    try {
      const response = await BackendApi.getPnlOverTime(address.value, interval);
      pnlOverTime.value = response.data;
      pnlOverTimeInterval.value = response.interval;
      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch PnL over time";
      console.error("[AnalyticsStore] Failed to fetch PnL over time:", e);
      throw e;
    } finally {
      pnlOverTimeLoading.value = false;
    }
  }

  /**
   * Fetch price series for a specific asset
   * Results are cached by key:protocol:interval
   */
  async function fetchPriceSeries(
    key: string,
    protocol: string,
    interval: string
  ): Promise<PriceDataPoint[]> {
    const cacheKey = `${key}:${protocol}:${interval}`;

    // Check cache first
    const cached = priceSeriesCache.value.get(cacheKey);
    if (cached) {
      return cached;
    }

    priceSeriesLoading.value = true;

    try {
      const response = await BackendApi.getPriceSeries(key, protocol, interval);
      priceSeriesCache.value.set(cacheKey, response.data);
      return response.data;
    } catch (e) {
      console.error("[AnalyticsStore] Failed to fetch price series:", e);
      throw e;
    } finally {
      priceSeriesLoading.value = false;
    }
  }

  // ==========================================================================
  // Actions - Lifecycle
  // ==========================================================================

  /**
   * Initialize the store with an address
   */
  async function initialize(newAddress: string): Promise<void> {
    if (initialized.value && address.value === newAddress) {
      return;
    }

    address.value = newAddress;
    initialized.value = true;

    // Fetch dashboard and history data in parallel
    await Promise.all([
      fetchDashboardData(),
      fetchHistoryData()
    ]);
  }

  /**
   * Set address and fetch user-specific data
   */
  async function setAddress(newAddress: string | null): Promise<void> {
    if (newAddress) {
      await initialize(newAddress);
    } else {
      cleanup();
    }
  }

  /**
   * Cleanup all user-specific data
   */
  function cleanup(): void {
    address.value = null;
    initialized.value = false;

    dashboardData.value = {
      earnings: null,
      realizedPnl: null,
      positionDebtValue: null
    };

    historyData.value = {
      historyStats: null,
      realizedPnlData: null
    };

    pnlOverTime.value = [];
    pnlOverTimeInterval.value = "";
    priceSeriesCache.value.clear();
    realizedPnlList.value = [];
    realizedPnlTotal.value = 0;

    error.value = null;
    lastUpdated.value = null;
  }

  // Alias for backwards compatibility
  const clear = cleanup;

  /**
   * Refresh all user data
   */
  async function refresh(): Promise<void> {
    if (!address.value) return;

    await Promise.all([
      fetchDashboardData(),
      fetchHistoryData()
    ]);
  }

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    address,
    dashboardData,
    historyData,
    pnlOverTime,
    pnlOverTimeInterval,
    priceSeriesCache,
    realizedPnlList,
    realizedPnlTotal,
    dashboardLoading,
    historyLoading,
    pnlOverTimeLoading,
    priceSeriesLoading,
    realizedPnlListLoading,
    error,
    lastUpdated,
    initialized,

    // Computed
    isConnected,
    hasEarnings,
    hasHistoryStats,
    earnings,
    realizedPnl,
    positionDebtValue,
    historyStats,
    realizedPnlData,

    // Actions - Dashboard
    fetchDashboardData,
    fetchEarnings,
    fetchPositionDebtValue,

    // Actions - History
    fetchHistoryData,
    fetchHistoryStats,
    fetchRealizedPnl,
    fetchRealizedPnlData,
    fetchPnlList,

    // Actions - Charts
    fetchPnlOverTime,
    fetchPriceSeries,

    // Actions - Lifecycle
    initialize,
    setAddress,
    cleanup,
    clear, // Alias for backwards compatibility
    refresh
  };
});
