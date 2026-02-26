import { type Ref } from "vue";
import type { Unsubscribe } from "@/common/api";

interface WebSocketLifecycleOptions {
  /** Ref holding the current wallet address */
  address: Ref<string | null>;
  /** Subscribe to WebSocket updates for the given address. Returns unsubscribe handle. */
  subscribe: (address: string) => Unsubscribe;
  /** Fetch initial data for the connected address */
  fetch: () => Promise<void>;
  /** Reset store state to defaults (called before new address or on cleanup) */
  resetState: () => void;
}

/**
 * Manages the subscribe → fetch → unsubscribe lifecycle for stores
 * that watch a wallet address and subscribe to WebSocket updates.
 *
 * Returns `setAddress` (for useWalletWatcher's onConnect) and `cleanup`
 * (for useWalletWatcher's onDisconnect). The store no longer needs to
 * manage the unsubscribe handle or guard logic itself.
 */
export function useWebSocketLifecycle(options: WebSocketLifecycleOptions) {
  let unsubscribe: Unsubscribe | null = null;

  function unsubscribeFromUpdates(): void {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  }

  function subscribeToUpdates(): void {
    if (!options.address.value || unsubscribe) {
      return;
    }
    unsubscribe = options.subscribe(options.address.value);
  }

  async function setAddress(newAddress: string | null): Promise<void> {
    unsubscribeFromUpdates();
    options.address.value = newAddress;
    options.resetState();

    if (newAddress) {
      await options.fetch();
      subscribeToUpdates();
    }
  }

  function cleanup(): void {
    unsubscribeFromUpdates();
    options.address.value = null;
    options.resetState();
  }

  return {
    setAddress,
    cleanup,
    subscribeToUpdates,
    unsubscribeFromUpdates
  };
}
