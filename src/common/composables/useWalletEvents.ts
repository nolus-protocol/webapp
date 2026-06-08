import { onUnmounted, watch } from "vue";
import { useWalletStore } from "@/common/stores/wallet";
import { useConfigStore } from "@/common/stores/config";
import { useConnectionStore } from "@/common/stores/connection";
import { useEarnStore } from "@/common/stores/earn";
import { IntercomService, Logger, WalletStorage, walletOperation, applyWalletProtocolFilter } from "@/common/utils";
import type { WalletConnectMechanism } from "@/common/types";

/**
 * Composable that manages wallet lifecycle events:
 * - Keplr keystorechange listener
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

  let keystoreInFlight = false;

  function createKeystoreListener(connectAction: () => Promise<void>) {
    return async () => {
      if (keystoreInFlight) return;
      keystoreInFlight = true;
      try {
        await IntercomService.disconnect();
        await connectAction();
        if (wallet.wallet?.address) {
          await connectionStore.connectWallet(wallet.wallet.address);
        }
        await loadNetwork();
      } catch (error: unknown) {
        Logger.error(error);
      } finally {
        keystoreInFlight = false;
      }
    };
  }

  const updateKeplr = createKeystoreListener(() => wallet.CONNECT_KEPLR());

  async function loadNetwork() {
    try {
      await Promise.all([wallet.LOAD_APR(), earnStore.fetchPools()]);
    } catch (error: unknown) {
      Logger.error(error);
    }
  }

  watch(
    () => configStore.initialized,
    async (initialized) => {
      if (!initialized) return;
      // Seed the wallet-owned network filter from the stored mechanism before the
      // (slow) reconnect chain resolves. Otherwise protocolFilter stays "" — and
      // the transfer forms key config.transfers[""] → empty — until a later tx
      // submit eventually runs a full connect. A null mechanism (disconnected)
      // maps to "", which the config-store watcher treats as a no-op.
      applyWalletProtocolFilter(WalletStorage.getWalletConnectMechanism() as WalletConnectMechanism | null);
      await walletOperation(() => {});
      if (wallet.wallet?.address) {
        await connectionStore.connectWallet(wallet.wallet.address);
      }
      window.addEventListener("keplr_keystorechange", updateKeplr);
      wallet.LOAD_APR();
    },
    { immediate: true }
  );

  onUnmounted(() => {
    window.removeEventListener("keplr_keystorechange", updateKeplr);
  });
}
