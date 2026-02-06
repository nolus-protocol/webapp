/**
 * Balances Store - User wallet balances from backend
 *
 * Uses WebSocket for real-time updates when wallet is connected.
 * Replaces direct RPC balance queries and the old wallet store balance management.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { BackendApi, WebSocketClient, type BalanceInfo, type BalancesResponse, type Unsubscribe } from "@/common/api";
import { useConfigStore } from "../config";
import { NATIVE_ASSET } from "@/config/global";
import type { ExternalCurrency } from "@/common/types";

export const useBalancesStore = defineStore("balances", () => {
  // State - stores array of BalanceInfo from backend
  const balances = ref<BalanceInfo[]>([]);
  const address = ref<string | null>(null);
  const totalValueUsd = ref<string>("0");
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  // Ignored currencies (user preference)
  const ignoredCurrencies = ref<string[]>([]);

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
   * Get balances filtered by current protocol filter
   * Uses /api/assets to determine which assets belong to which network
   */
  const filteredBalances = computed((): ExternalCurrency[] => {
    const configStore = useConfigStore();

    // Validate that the protocol filter is valid
    if (!configStore.isValidNetworkFilter(configStore.protocolFilter)) {
      return [];
    }

    // Get asset tickers available for this network from /api/assets
    const availableTickers = configStore.getAssetTickersForNetwork(configStore.protocolFilter);

    if (availableTickers.length === 0) {
      return [];
    }

    const result: ExternalCurrency[] = [];
    const seenTickers = new Map<string, number>(); // ticker -> index in result
    const networkProtocols = configStore.getActiveProtocolsForNetwork(configStore.protocolFilter);

    for (const balance of balances.value) {
      // Get currency info from config store
      const currency = configStore.getCurrencyByDenom(balance.denom);

      if (!currency) {
        continue;
      }

      const ticker = currency.ticker;

      // Skip ignored currencies
      if (ignoredCurrencies.value.includes(ticker)) {
        continue;
      }

      // Skip assets not available for this network (based on /api/assets)
      if (!availableTickers.includes(ticker)) {
        continue;
      }

      const entry = {
        ...currency,
        balance: {
          denom: balance.denom,
          amount: balance.amount
        }
      } as ExternalCurrency;

      const existingIndex = seenTickers.get(ticker);
      if (existingIndex !== undefined) {
        // Replace if this currency's protocol belongs to the current network
        const belongsToNetwork = networkProtocols.includes(currency.protocol);
        if (belongsToNetwork) {
          result[existingIndex] = entry;
        }
        continue;
      }

      seenTickers.set(ticker, result.length);
      result.push(entry);
    }

    return result;
  });

  /**
   * Get native asset balance
   */
  const nativeBalance = computed(() => {
    return balanceByDenom.value.get(NATIVE_ASSET.denom);
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

    const isInitialLoad = !lastUpdated.value;
    if (isInitialLoad) {
      loading.value = true;
    }
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
      if (isInitialLoad) {
        loading.value = false;
      }
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
    lastUpdated.value = null;

    if (newAddress) {
      await fetchBalances();
      subscribeToUpdates();
    }
  }

  /**
   * Cleanup store state (on disconnect)
   */
  function cleanup(): void {
    unsubscribeFromUpdates();
    address.value = null;
    balances.value = [];
    totalValueUsd.value = "0";
    lastUpdated.value = null;
    error.value = null;
  }

  // Alias for backwards compatibility
  const clear = cleanup;

  /**
   * Add a currency to the ignore list
   */
  function ignoreCurrency(ticker: string): void {
    if (!ignoredCurrencies.value.includes(ticker)) {
      ignoredCurrencies.value.push(ticker);
      saveIgnoredCurrencies();
    }
  }

  /**
   * Remove a currency from the ignore list
   */
  function unignoreCurrency(ticker: string): void {
    const index = ignoredCurrencies.value.indexOf(ticker);
    if (index > -1) {
      ignoredCurrencies.value.splice(index, 1);
      saveIgnoredCurrencies();
    }
  }

  /**
   * Set ignored currencies list
   */
  function setIgnoredCurrencies(tickers: string[]): void {
    ignoredCurrencies.value = tickers;
    saveIgnoredCurrencies();
  }

  /**
   * Save ignored currencies to localStorage
   */
  function saveIgnoredCurrencies(): void {
    try {
      localStorage.setItem("ignored_currencies", JSON.stringify(ignoredCurrencies.value));
    } catch (e) {
      console.warn("[BalancesStore] Failed to save ignored currencies:", e);
    }
  }

  /**
   * Load ignored currencies from localStorage
   */
  function loadIgnoredCurrencies(): void {
    try {
      const stored = localStorage.getItem("ignored_currencies");
      if (stored) {
        ignoredCurrencies.value = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("[BalancesStore] Failed to load ignored currencies:", e);
    }
  }

  // Load ignored currencies on store creation
  loadIgnoredCurrencies();

  return {
    // State
    balances,
    address,
    totalValueUsd,
    loading,
    error,
    lastUpdated,
    ignoredCurrencies,

    // Computed
    hasBalances,
    isConnected,
    filteredBalances,
    nativeBalance,

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
    cleanup,
    clear, // Alias for backwards compatibility
    ignoreCurrency,
    unignoreCurrency,
    setIgnoredCurrencies
  };
});
