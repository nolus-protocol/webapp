/**
 * Prices Store - Real-time price data from backend
 *
 * Replaces the old useOracleStore. Fetches prices from the Rust backend
 * which queries Oracle contracts on-chain.
 *
 * Uses localStorage for optimistic loading - shows cached data immediately
 * while fetching fresh data in the background.
 */

import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { BackendApi, type PriceData } from "@/common/api";

const STORAGE_KEY = "nolus_prices_cache";
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes - max age for cached data

export const usePricesStore = defineStore("prices", () => {
  // State
  const prices = ref<PriceData>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  // Polling interval handle
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Load cached prices from localStorage (for optimistic loading)
   */
  function loadFromCache(): boolean {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (!cached) return false;

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      // Only use cache if it's not too stale
      if (age < CACHE_MAX_AGE_MS && data && Object.keys(data).length > 0) {
        prices.value = data;
        lastUpdated.value = new Date(timestamp);
        return true;
      }
    } catch (e) {
      console.warn("[PricesStore] Failed to load from cache:", e);
    }
    return false;
  }

  /**
   * Save prices to localStorage for future optimistic loading
   */
  function saveToCache(): void {
    try {
      const cacheData = {
        data: prices.value,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
    } catch (e) {
      console.warn("[PricesStore] Failed to save to cache:", e);
    }
  }

  // Auto-save to cache when prices change
  watch(prices, () => {
    if (Object.keys(prices.value).length > 0) {
      saveToCache();
    }
  }, { deep: true });

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
    loading.value = true;
    error.value = null;

    try {
      prices.value = await BackendApi.getPrices();
      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch prices";
      console.error("[PricesStore] Failed to fetch prices:", e);
    } finally {
      loading.value = false;
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
   * Initialize the store - load cache immediately, then fetch fresh data
   * This provides optimistic loading - users see data instantly while
   * fresh data loads in the background.
   */
  async function initialize(): Promise<void> {
    // Load cached data immediately for instant UI
    const hadCache = loadFromCache();

    // Fetch fresh data (don't await if we had cache - background refresh)
    if (hadCache) {
      // Background refresh - don't block initialization
      fetchPrices().catch((e) => {
        console.error("[PricesStore] Background refresh failed:", e);
      });
    } else {
      // No cache - must wait for fresh data
      await fetchPrices();
    }

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
