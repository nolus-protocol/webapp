/**
 * Client Entry Point
 *
 * This entry point:
 * - Initializes the Vue application
 * - Sets up the backend connection via useConnectionStore
 * - Initializes theme from localStorage
 * - Watches wallet changes to sync with stores
 */

import { watch } from "vue";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { createApp } from "./main";
import { fetchEndpoints } from "./common/utils/EndpointService";
import { initTheme } from "./common/utils/ThemeManager";
import { useConnectionStore } from "./common/stores/connection";
import { useWalletStore } from "./common/stores/wallet";

const { app, router } = createApp();

async function bootstrap() {
  // Initialize NolusClient with RPC endpoint (still needed for wallet signing)
  const rpc = (await fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;
  NolusClient.setInstance(rpc);

  // Mount the app first
  app.mount("#app");

  // Initialize theme from localStorage (no store needed)
  initTheme();

  // Initialize backend connection and stores (config, currencies, prices, etc.)
  const connectionStore = useConnectionStore();
  await connectionStore.initializeApp();

  // Initialize wallet store for ignored assets
  const walletStore = useWalletStore();
  await walletStore.ignoreAssets();

  // Watch wallet changes and sync with new stores
  watch(
    () => walletStore.wallet?.address,
    async (newAddress, oldAddress) => {
      if (newAddress && newAddress !== oldAddress) {
        console.log("[App] Wallet connected:", newAddress);
        await connectionStore.connectWallet(newAddress);
      } else if (!newAddress && oldAddress) {
        console.log("[App] Wallet disconnected");
        connectionStore.disconnectWallet();
      }
    },
    { immediate: true }
  );

  console.log("[App] Initialized successfully");
}

router
  .isReady()
  .then(() => {
    return bootstrap();
  })
  .catch((error) => {
    console.error("[App] Failed to initialize:", error);
  });
