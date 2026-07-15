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
  type PoolInfo,
  type SuppliedFundsResponse
} from "@/common/api";
import { useWalletWatcher } from "@/common/composables/useWalletWatcher";
import { useWebSocketLifecycle } from "@/common/composables/useWebSocketLifecycle";

// WS partial updates deliberately set deposited_usd to null until the next
// full fetch replaces it; the API type only allows string | undefined.
type StoredEarnPosition = Omit<EarnPosition, "deposited_usd"> & { deposited_usd?: string | null | undefined };

export const useEarnStore = defineStore("earn", () => {
  // State
  const pools = ref<EarnPool[]>([]);
  const etlPools = ref<PoolInfo[]>([]);
  const positions = ref<StoredEarnPosition[]>([]);
  const stats = ref<EarnStats | null>(null);
  const suppliedFunds = ref<SuppliedFundsResponse | null>(null);
  const address = ref<string | null>(null);
  const totalDepositedUsd = ref<string>("0");

  const poolsLoading = ref(false);
  const positionsLoading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);
  const initialized = ref(false);

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
  function getPosition(protocol: string): StoredEarnPosition | undefined {
    return positions.value.find((p) => p.protocol === protocol);
  }

  /**
   * Get pool by LPP address
   */
  function getPoolByAddress(lppAddress: string): EarnPool | undefined {
    return pools.value.find((p) => p.lpp_address === lppAddress);
  }

  /**
   * Get ETL pool data by protocol (includes deposit_suspension)
   */
  function getEtlPool(protocol: string): PoolInfo | undefined {
    return etlPools.value.find((p) => p.protocol === protocol);
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
      error.value = e instanceof Error ? e.message : "Failed to fetch earn stats";
      console.error("[EarnStore] Failed to fetch stats:", e);
    }
  }

  /**
   * Fetch ETL pools data (includes deposit_suspension thresholds)
   */
  async function fetchEtlPools(): Promise<void> {
    try {
      const response = await BackendApi.getEtlPools();
      etlPools.value = response.protocols;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch ETL pools";
      console.error("[EarnStore] Failed to fetch ETL pools:", e);
    }
  }

  /**
   * Fetch supplied funds from ETL
   */
  async function fetchSuppliedFunds(): Promise<void> {
    try {
      suppliedFunds.value = await BackendApi.getSuppliedFunds();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch supplied funds";
      console.error("[EarnStore] Failed to fetch supplied funds:", e);
    }
  }

  // WebSocket lifecycle: subscribe, fetch, unsubscribe, cleanup
  const { setAddress, cleanup } = useWebSocketLifecycle({
    address,
    subscribe: (addr) =>
      // The WS earn total is deliberately ignored: the backend hardcodes
      // total_deposited_usd="0.00" on every push ("would need prices", websocket.rs),
      // so the REST-derived totalDepositedUsd is kept until the next full fetch.
      WebSocketClient.subscribeEarn(addr, (wsAddr, wsPositions) => {
        if (wsAddr !== address.value) return;

        // Merge WS-owned fields (deposited_lpn, deposited_asset) into a matched REST
        // record so its REST-only fields (deposited_usd/current_apy/currency/lpp_price)
        // survive; an unmatched WS position gets a placeholder until the next fetch.
        // Positions absent from the payload drop — same wholesale-replace removal
        // semantics as REST fetchPositions.
        const existingByKey = new Map(positions.value.map((p) => [`${p.protocol}::${p.lpp_address}`, p]));
        positions.value = wsPositions.map((p) => {
          const existing = existingByKey.get(`${p.protocol}::${p.lpp_address}`);
          if (existing) {
            return { ...existing, deposited_nlpn: p.deposited_asset, deposited_lpn: p.deposited_lpn };
          }
          return {
            protocol: p.protocol,
            lpp_address: p.lpp_address,
            currency: "",
            deposited_nlpn: p.deposited_asset,
            deposited_lpn: p.deposited_lpn,
            deposited_usd: null,
            lpp_price: "1.0",
            current_apy: 0
          };
        });
        lastUpdated.value = new Date();
      }),
    fetch: fetchPositions,
    resetState: () => {
      positions.value = [];
      totalDepositedUsd.value = "0";
      lastUpdated.value = null;
      error.value = null;
    }
  });

  /**
   * Initialize the store
   */
  async function initialize(): Promise<void> {
    if (initialized.value) {
      return;
    }
    await Promise.all([fetchPools(), fetchStats(), fetchEtlPools(), fetchSuppliedFunds()]);
    initialized.value = pools.value.length > 0;
  }

  /**
   * Refresh all data
   */
  async function refresh(): Promise<void> {
    const promises: Promise<void>[] = [fetchPools(), fetchStats(), fetchEtlPools(), fetchSuppliedFunds()];
    if (address.value) {
      promises.push(fetchPositions());
    }
    await Promise.all(promises);
  }

  // Self-register: watch wallet address changes from connectionStore.
  useWalletWatcher(setAddress, cleanup, fetchPositions);

  return {
    // State
    pools,
    etlPools,
    positions,
    stats,
    suppliedFunds,
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
    getEtlPool,
    getProtocolApr,

    // Actions
    fetchPools,
    fetchPositions,
    fetchStats,
    fetchEtlPools,
    fetchSuppliedFunds,
    setAddress,
    initialize,
    refresh,
    cleanup
  };
});
