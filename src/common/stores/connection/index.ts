/**
 * Connection Store - Manages WebSocket connection and coordinates stores
 *
 * This store handles:
 * - WebSocket connection lifecycle
 * - Coordinating store initialization when wallet connects/disconnects
 * - Connection state tracking
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { WebSocketClient, type ConnectionState, type Unsubscribe } from "@/common/api";
import { useConfigStore } from "../config";
import { usePricesStore } from "../prices";
import { useBalancesStore } from "../balances";
import { useLeasesStore } from "../leases";
import { useStakingStore } from "../staking";
import { useEarnStore } from "../earn";
import { useStatsStore } from "../stats";
import { useAnalyticsStore } from "../analytics";

export const useConnectionStore = defineStore("connection", () => {
  // State
  const wsState = ref<ConnectionState>("disconnected");
  const walletAddress = ref<string | null>(null);
  const appInitialized = ref(false);
  const initializing = ref(false);
  const error = ref<string | null>(null);

  // WebSocket state subscription
  let wsStateUnsubscribe: Unsubscribe | null = null;

  // Computed
  const isWsConnected = computed(() => wsState.value === "connected");
  const isWalletConnected = computed(() => walletAddress.value !== null);
  const isReady = computed(() => appInitialized.value && isWsConnected.value);

  /**
   * Initialize the application
   * - Connect WebSocket
   * - Fetch initial config and prices
   */
  async function initializeApp(): Promise<void> {
    if (appInitialized.value || initializing.value) {
      return;
    }

    initializing.value = true;
    error.value = null;

    try {
      // Subscribe to WebSocket state changes
      wsStateUnsubscribe = WebSocketClient.onConnectionStateChange((state) => {
        wsState.value = state;
      });

      // Connect WebSocket
      await WebSocketClient.connect();

      // Initialize stores that don't require wallet
      const configStore = useConfigStore();
      const pricesStore = usePricesStore();
      const stakingStore = useStakingStore();
      const earnStore = useEarnStore();
      const statsStore = useStatsStore();

      await Promise.all([
        configStore.initialize(),
        pricesStore.initialize(),
        stakingStore.initialize(),
        earnStore.initialize(),
        statsStore.initialize(),
      ]);

      appInitialized.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to initialize app";
      console.error("[ConnectionStore] Failed to initialize app:", e);
    } finally {
      initializing.value = false;
    }
  }

  /**
   * Connect wallet - update all stores with user address
   */
  async function connectWallet(address: string): Promise<void> {
    if (!address) {
      return;
    }

    walletAddress.value = address;

    // Update all user-specific stores
    const balancesStore = useBalancesStore();
    const leasesStore = useLeasesStore();
    const stakingStore = useStakingStore();
    const earnStore = useEarnStore();
    const analyticsStore = useAnalyticsStore();

    await Promise.all([
      balancesStore.setAddress(address),
      leasesStore.setOwner(address),
      stakingStore.setAddress(address),
      earnStore.setAddress(address),
      analyticsStore.setAddress(address),
    ]);
  }

  /**
   * Disconnect wallet - clear all user-specific data
   */
  function disconnectWallet(): void {
    walletAddress.value = null;

    // Clear all user-specific stores
    const balancesStore = useBalancesStore();
    const leasesStore = useLeasesStore();
    const stakingStore = useStakingStore();
    const earnStore = useEarnStore();
    const analyticsStore = useAnalyticsStore();

    balancesStore.clear();
    leasesStore.clear();
    stakingStore.clear();
    earnStore.clear();
    analyticsStore.clear();
  }

  /**
   * Refresh all data
   */
  async function refreshAll(): Promise<void> {
    const pricesStore = usePricesStore();
    const earnStore = useEarnStore();
    const stakingStore = useStakingStore();
    const statsStore = useStatsStore();

    const promises: Promise<void>[] = [
      pricesStore.fetchPrices(),
      earnStore.refresh(),
      stakingStore.fetchValidators(),
      statsStore.refresh(),
    ];

    if (walletAddress.value) {
      const balancesStore = useBalancesStore();
      const leasesStore = useLeasesStore();
      const analyticsStore = useAnalyticsStore();

      promises.push(
        balancesStore.fetchBalances(),
        leasesStore.fetchLeases(),
        stakingStore.fetchPositions(),
        earnStore.fetchPositions(),
        analyticsStore.refresh()
      );
    }

    await Promise.all(promises);
  }

  /**
   * Cleanup - disconnect WebSocket
   */
  function cleanup(): void {
    if (wsStateUnsubscribe) {
      wsStateUnsubscribe();
      wsStateUnsubscribe = null;
    }

    WebSocketClient.disconnect();

    // Cleanup all stores
    const pricesStore = usePricesStore();
    const statsStore = useStatsStore();
    pricesStore.cleanup();
    statsStore.cleanup();

    disconnectWallet();

    appInitialized.value = false;
    wsState.value = "disconnected";
  }

  return {
    // State
    wsState,
    walletAddress,
    appInitialized,
    initializing,
    error,

    // Computed
    isWsConnected,
    isWalletConnected,
    isReady,

    // Actions
    initializeApp,
    connectWallet,
    disconnectWallet,
    refreshAll,
    cleanup,
  };
});
