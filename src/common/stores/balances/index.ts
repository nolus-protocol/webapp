/**
 * Balances Store - User wallet balances from backend
 *
 * Uses WebSocket for real-time updates when wallet is connected.
 * Replaces direct RPC balance queries.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { BackendApi, WebSocketClient, type BalanceInfo, type BalancesResponse, type Unsubscribe } from "@/common/api";

export const useBalancesStore = defineStore("balances", () => {
  // State - stores array of BalanceInfo from backend
  const balances = ref<BalanceInfo[]>([]);
  const address = ref<string | null>(null);
  const totalValueUsd = ref<string>("0");
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  // WebSocket subscription handle
  let unsubscribe: Unsubscribe | null = null;

  // Computed
  const hasBalances = computed(() => balances.value.length > 0);
  const isConnected = computed(() => address.value !== null);

  // Balance lookup by denom
  const balanceByDenom = computed(() => {
    const map = new Map<string, BalanceInfo>();
    balances.value.forEach((b) => map.set(b.denom, b));
    return map;
  });

  // Balance lookup by key
  const balanceByKey = computed(() => {
    const map = new Map<string, BalanceInfo>();
    balances.value.forEach((b) => map.set(b.key, b));
    return map;
  });

  /**
   * Get balance for a specific denom
   */
  function getBalance(denom: string): string {
    return balanceByDenom.value.get(denom)?.amount ?? "0";
  }

  /**
   * Get balance info for a specific denom
   */
  function getBalanceInfo(denom: string): BalanceInfo | undefined {
    return balanceByDenom.value.get(denom);
  }

  /**
   * Get balance by currency key
   */
  function getBalanceByKey(key: string): BalanceInfo | undefined {
    return balanceByKey.value.get(key);
  }

  /**
   * Get balance as a number
   */
  function getBalanceAsNumber(denom: string): number {
    return parseFloat(getBalance(denom));
  }

  /**
   * Check if user has any balance for a denom
   */
  function hasBalance(denom: string): boolean {
    const balance = getBalanceAsNumber(denom);
    return balance > 0;
  }

  /**
   * Fetch balances for the connected address
   */
  async function fetchBalances(): Promise<void> {
    if (!address.value) {
      return;
    }

    loading.value = true;
    error.value = null;

    try {
      const response: BalancesResponse = await BackendApi.getBalances(address.value);
      balances.value = response.balances;
      totalValueUsd.value = response.total_value_usd;
      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch balances";
      console.error("[BalancesStore] Failed to fetch balances:", e);
    } finally {
      loading.value = false;
    }
  }

  /**
   * Subscribe to real-time balance updates via WebSocket
   */
  function subscribeToUpdates(): void {
    if (!address.value || unsubscribe) {
      return;
    }

    unsubscribe = WebSocketClient.subscribeBalances(address.value, (addr, newBalances) => {
      if (addr === address.value) {
        // WebSocket may send balance updates in different format
        // Handle both array and object formats
        if (Array.isArray(newBalances)) {
          balances.value = newBalances;
        }
        lastUpdated.value = new Date();
      }
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
   * Set the wallet address and fetch balances
   */
  async function setAddress(newAddress: string | null): Promise<void> {
    // Cleanup previous subscription
    unsubscribeFromUpdates();
    
    address.value = newAddress;
    balances.value = [];
    totalValueUsd.value = "0";

    if (newAddress) {
      await fetchBalances();
      subscribeToUpdates();
    }
  }

  /**
   * Clear balances (on disconnect)
   */
  function clear(): void {
    unsubscribeFromUpdates();
    address.value = null;
    balances.value = [];
    totalValueUsd.value = "0";
    lastUpdated.value = null;
    error.value = null;
  }

  return {
    // State
    balances,
    address,
    totalValueUsd,
    loading,
    error,
    lastUpdated,

    // Computed
    hasBalances,
    isConnected,

    // Getters
    getBalance,
    getBalanceInfo,
    getBalanceByKey,
    getBalanceAsNumber,
    hasBalance,

    // Actions
    fetchBalances,
    subscribeToUpdates,
    unsubscribeFromUpdates,
    setAddress,
    clear,
  };
});
