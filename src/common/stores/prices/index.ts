/**
 * Prices Store - Real-time price data from backend
 *
 * Fetches prices from the Rust backend which queries Oracle contracts on-chain.
 * Browser HTTP cache (Cache-Control: max-age=10, stale-while-revalidate=5)
 * handles caching at the network layer.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { BackendApi, type PriceData } from "@/common/api";

export const usePricesStore = defineStore("prices", () => {
  // State
  const prices = ref<PriceData>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  // Polling interval handle
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // Computed
  const priceCount = computed(() => Object.keys(prices.value).length);

  /**
   * Get price for a specific key (ticker@protocol or ibcData)
   * Returns the price string or null if not found
   */
  function getPrice(key: string): string | null {
    const priceData = prices.value[key];
    return priceData?.price ?? null;
  }

  /**
   * Get price as a number
   */
  function getPriceAsNumber(key: string): number {
    const price = getPrice(key);
    return price ? parseFloat(price) : 0;
  }

  /**
   * Check if a key has price data
   */
  function hasPrice(key: string): boolean {
    return key in prices.value;
  }

  /**
   * Fetch prices from backend
   */
  async function fetchPrices(): Promise<void> {
    const isInitialLoad = !lastUpdated.value;
    if (isInitialLoad) {
      loading.value = true;
    }
    error.value = null;

    try {
      prices.value = await BackendApi.getPrices();
      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch prices";
      console.error("[PricesStore] Failed to fetch prices:", e);
    } finally {
      if (isInitialLoad) {
        loading.value = false;
      }
    }
  }

  /**
   * Start polling for price updates
   */
  function startPolling(intervalMs: number = 30000): void {
    if (pollInterval) {
      return; // Already polling
    }

    pollInterval = setInterval(() => {
      fetchPrices().catch((e) => {
        console.error("[PricesStore] Polling error:", e);
      });
    }, intervalMs);
  }

  /**
   * Stop polling for price updates
   */
  function stopPolling(): void {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  /**
   * Initialize the store - fetch fresh data, then start polling
   */
  async function initialize(): Promise<void> {
    await fetchPrices();
    startPolling();
  }

  /**
   * Cleanup - stop polling
   */
  function cleanup(): void {
    stopPolling();
  }

  return {
    // State
    prices,
    loading,
    error,
    lastUpdated,

    // Computed
    priceCount,

    // Getters
    getPrice,
    getPriceAsNumber,
    hasPrice,

    // Actions
    fetchPrices,
    startPolling,
    stopPolling,
    initialize,
    cleanup,
  };
});
