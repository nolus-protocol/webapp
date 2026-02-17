/**
 * Connection Store - Manages WebSocket connection and wallet address state
 *
 * This store handles:
 * - WebSocket connection lifecycle
 * - Wallet address state (user-specific stores self-register via watchers)
 * - Global store initialization
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { WebSocketClient, type ConnectionState, type Unsubscribe } from "@/common/api";
import { useConfigStore } from "../config";
import { usePricesStore } from "../prices";
import { useStakingStore } from "../staking";
import { useEarnStore } from "../earn";
import { useStatsStore } from "../stats";

export const useConnectionStore = defineStore("connection", () => {
  // State
  const wsState = ref<ConnectionState>("disconnected");
  const walletAddress = ref<string | null>(null);
  const appInitialized = ref(false);
  const initializing = ref(false);
  const error = ref<string | null>(null);
  const wsReconnectCount = ref(0);

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
        const wasDisconnected = wsState.value !== "connected";
        wsState.value = state;

        // Trigger user data refresh after reconnection to avoid stale state
        if (state === "connected" && wasDisconnected && walletAddress.value) {
          wsReconnectCount.value++;
        }
      });

      // Connect WebSocket
      await WebSocketClient.connect();

      // Initialize stores that don't require wallet
      const configStore = useConfigStore();
      const pricesStore = usePricesStore();
      const stakingStore = useStakingStore();
      const earnStore = useEarnStore();
      const statsStore = useStatsStore();

      // Config must initialize first — other stores depend on currency/protocol data
      await configStore.initialize();
      await Promise.all([
        pricesStore.initialize(),
        stakingStore.initialize(),
        earnStore.initialize(),
        statsStore.initialize()
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
   * Connect wallet - sets address; user-specific stores react via watchers
   */
  function connectWallet(address: string): void {
    if (!address) {
      return;
    }
    walletAddress.value = address;
  }

  /**
   * Disconnect wallet - clears address; user-specific stores react via watchers
   */
  function disconnectWallet(): void {
    walletAddress.value = null;
  }

  /**
   * Cleanup - disconnect WebSocket
   */
  function cleanup(): void {
    if (wsStateUnsubscribe) {
      wsStateUnsubscribe();
      wsStateUnsubscribe = null;
    }

    // Disconnect wallet FIRST — user-specific stores react via watchers
    // and send WS unsubscribe messages while connection is still open
    const pricesStore = usePricesStore();
    const statsStore = useStatsStore();
    pricesStore.cleanup();
    statsStore.cleanup();
    disconnectWallet();

    // THEN disconnect WebSocket
    WebSocketClient.disconnect();

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
    wsReconnectCount,

    // Computed
    isWsConnected,
    isWalletConnected,
    isReady,

    // Actions
    initializeApp,
    connectWallet,
    disconnectWallet,
    cleanup
  };
});
