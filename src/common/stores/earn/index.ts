/**
 * Earn Store - Liquidity pools and earn positions from backend
 *
 * Provides pool data and user deposit positions.
 * Replaces direct LPP contract queries.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  BackendApi,
  WebSocketClient,
  type EarnPool,
  type EarnPosition,
  type EarnPositionsResponse,
  type EarnStats,
  type Unsubscribe,
} from "@/common/api";

export const useEarnStore = defineStore("earn", () => {
  // State
  const pools = ref<EarnPool[]>([]);
  const positions = ref<EarnPosition[]>([]);
  const stats = ref<EarnStats | null>(null);
  const address = ref<string | null>(null);
  const totalDepositedUsd = ref<string>("0");

  const poolsLoading = ref(false);
  const positionsLoading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  const initialized = ref(false);

  // WebSocket subscription handle
  let unsubscribe: Unsubscribe | null = null;

  // Computed
  const hasPositions = computed(() => positions.value.length > 0);
  const poolCount = computed(() => pools.value.length);

  const totalDeposited = computed(() => {
    return positions.value.reduce((sum, p) => {
      return sum + parseFloat(p.deposited_lpn || "0");
    }, 0);
  });

  /**
   * APR/APY by protocol - replaces old app.apr
   * Returns a map of protocol key to APY percentage
   */
  const protocolApr = computed<{ [protocol: string]: number }>(() => {
    const result: { [protocol: string]: number } = {};
    for (const pool of pools.value) {
      result[pool.protocol] = pool.apy;
    }
    return result;
  });

  /**
   * Get pool by protocol key
   */
  function getPool(protocol: string): EarnPool | undefined {
    return pools.value.find((p) => p.protocol === protocol);
  }

  /**
   * Get position by protocol key
   */
  function getPosition(protocol: string): EarnPosition | undefined {
    return positions.value.find((p) => p.protocol === protocol);
  }

  /**
   * Get pool by LPP address
   */
  function getPoolByAddress(lppAddress: string): EarnPool | undefined {
    return pools.value.find((p) => p.lpp_address === lppAddress);
  }

  /**
   * Get APR/APY for a specific protocol
   */
  function getProtocolApr(protocol: string): number {
    return protocolApr.value[protocol] ?? 0;
  }

  /**
   * Fetch all earn pools
   */
  async function fetchPools(): Promise<void> {
    poolsLoading.value = true;
    error.value = null;

    try {
      pools.value = await BackendApi.getEarnPools();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch pools";
      console.error("[EarnStore] Failed to fetch pools:", e);
    } finally {
      poolsLoading.value = false;
    }
  }

  /**
   * Fetch earn positions for connected address
   */
  async function fetchPositions(): Promise<void> {
    if (!address.value) {
      return;
    }

    positionsLoading.value = true;
    error.value = null;

    try {
      const response: EarnPositionsResponse = await BackendApi.getEarnPositions(address.value);
      positions.value = response.positions;
      totalDepositedUsd.value = response.total_deposited_usd;
      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch positions";
      console.error("[EarnStore] Failed to fetch positions:", e);
    } finally {
      positionsLoading.value = false;
    }
  }

  /**
   * Fetch earn statistics
   */
  async function fetchStats(): Promise<void> {
    try {
      stats.value = await BackendApi.getEarnStats();
    } catch (e) {
      console.error("[EarnStore] Failed to fetch stats:", e);
    }
  }

  /**
   * Subscribe to real-time updates via WebSocket
   */
  function subscribeToUpdates(): void {
    if (!address.value || unsubscribe) {
      return;
    }

    // Subscribe to earn position updates via WebSocket
    unsubscribe = WebSocketClient.subscribeEarn(address.value, (addr, wsPositions, totalUsd) => {
      if (addr !== address.value) return;

      // Update positions from WebSocket data
      positions.value = wsPositions.map((p) => ({
        protocol: p.protocol,
        lpp_address: p.lpp_address,
        currency: "", // Not provided by WS, will be filled on next full fetch
        deposited_nlpn: p.deposited_asset,
        deposited_lpn: p.deposited_lpn,
        deposited_usd: null,
        lpp_price: "1.0",
        current_apy: 0,
      }));
      totalDepositedUsd.value = totalUsd;
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
   * Set the address and fetch positions
   */
  async function setAddress(newAddress: string | null): Promise<void> {
    unsubscribeFromUpdates();

    address.value = newAddress;
    positions.value = [];
    totalDepositedUsd.value = "0";

    if (newAddress) {
      await fetchPositions();
      subscribeToUpdates();
    }
  }

  /**
   * Initialize the store
   */
  async function initialize(): Promise<void> {
    if (initialized.value) {
      return;
    }
    await Promise.all([fetchPools(), fetchStats()]);
    initialized.value = true;
  }

  /**
   * Refresh all data
   */
  async function refresh(): Promise<void> {
    const promises: Promise<void>[] = [fetchPools(), fetchStats()];
    if (address.value) {
      promises.push(fetchPositions());
    }
    await Promise.all(promises);
  }

  /**
   * Cleanup store state (on disconnect)
   */
  function cleanup(): void {
    unsubscribeFromUpdates();
    address.value = null;
    positions.value = [];
    totalDepositedUsd.value = "0";
    lastUpdated.value = null;
    error.value = null;
  }

  // Alias for backwards compatibility
  const clear = cleanup;

  return {
    // State
    pools,
    positions,
    stats,
    address,
    totalDepositedUsd,
    poolsLoading,
    positionsLoading,
    error,
    lastUpdated,
    initialized,

    // Computed
    hasPositions,
    poolCount,
    totalDeposited,
    protocolApr,

    // Getters
    getPool,
    getPosition,
    getPoolByAddress,
    getProtocolApr,

    // Actions
    fetchPools,
    fetchPositions,
    fetchStats,
    subscribeToUpdates,
    unsubscribeFromUpdates,
    setAddress,
    initialize,
    refresh,
    cleanup,
    clear, // Alias for backwards compatibility
  };
});
