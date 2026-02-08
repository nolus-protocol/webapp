/**
 * Prices Store - Real-time price data from backend via WebSocket
 *
 * Initial prices are fetched via REST, then kept up-to-date via WebSocket
 * subscription to the backend's event-driven price updates (~6s cadence).
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { BackendApi, WebSocketClient, type PriceData, type Unsubscribe } from "@/common/api";

export const usePricesStore = defineStore("prices", () => {
  // State
  const prices = ref<PriceData>({});
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  // WebSocket subscription handle
  let unsubscribe: Unsubscribe | null = null;

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
   * Fetch prices from backend (used for initial load only)
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
   * Subscribe to real-time price updates via WebSocket.
   *
   * The backend sends `{key: "price_string"}` but the store uses
   * `PriceData` format `{key: {price, symbol}}`. We merge WS updates
   * into the existing store data to preserve the symbol field and
   * only overwrite the price value.
   */
  function subscribeToPrices(): void {
    if (unsubscribe) {
      return;
    }

    unsubscribe = WebSocketClient.subscribePrices((wsUpdate: Record<string, string>) => {
      const current = prices.value;
      const updated: PriceData = { ...current };
      for (const [key, priceStr] of Object.entries(wsUpdate)) {
        updated[key] = {
          price: priceStr,
          symbol: current[key]?.symbol ?? key.split("@")[0]
        };
      }
      prices.value = updated;
      lastUpdated.value = new Date();
    });
  }

  /**
   * Unsubscribe from real-time price updates
   */
  function unsubscribeFromPrices(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  /**
   * Initialize the store - fetch fresh data, then subscribe to WebSocket updates
   */
  async function initialize(): Promise<void> {
    await fetchPrices();
    subscribeToPrices();
  }

  /**
   * Cleanup - unsubscribe from WebSocket
   */
  function cleanup(): void {
    unsubscribeFromPrices();
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
    initialize,
    cleanup
  };
});
