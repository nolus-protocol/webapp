import { onUnmounted, watch } from "vue";
import { useWalletStore } from "@/common/stores/wallet";
import { useConfigStore } from "@/common/stores/config";
import { useConnectionStore } from "@/common/stores/connection";
import { useEarnStore } from "@/common/stores/earn";
import { IntercomService, Logger, walletOperation } from "@/common/utils";

/**
 * Composable that manages wallet lifecycle events:
 * - Keplr/Leap keystorechange listeners
 * - Initial wallet connection on config init
 * - APR loading
 *
 * Call once from the root layout component (view.vue).
 */
export function useWalletEvents(): void {
  const wallet = useWalletStore();
  const configStore = useConfigStore();
  const connectionStore = useConnectionStore();
  const earnStore = useEarnStore();

  function createKeystoreHandler(connectAction: () => Promise<void>) {
    return async () => {
      try {
        await IntercomService.disconnect();
        await connectAction();
        if (wallet.wallet?.address) {
          await connectionStore.connectWallet(wallet.wallet.address);
        }
        await loadNetwork();
      } catch (error: Error | any) {
        Logger.error(error);
      }
    };
  }

  const updateKeplr = createKeystoreHandler(() => wallet.CONNECT_KEPLR());
  const updateLeap = createKeystoreHandler(() => wallet.CONNECT_LEAP());

  async function loadNetwork() {
    try {
      await Promise.all([wallet.LOAD_APR(), earnStore.fetchPools()]);
    } catch (error: Error | any) {
      Logger.error(error);
    }
  }

  watch(
    () => configStore.initialized,
    async (initialized) => {
      if (!initialized) return;
      await walletOperation(() => {});
      if (wallet.wallet?.address) {
        await connectionStore.connectWallet(wallet.wallet.address);
      }
      window.addEventListener("keplr_keystorechange", updateKeplr);
      window.addEventListener("leap_keystorechange", updateLeap);
      wallet.LOAD_APR();
    },
    { immediate: true }
  );

  onUnmounted(() => {
    window.removeEventListener("keplr_keystorechange", updateKeplr);
    window.removeEventListener("leap_keystorechange", updateLeap);
  });
}
