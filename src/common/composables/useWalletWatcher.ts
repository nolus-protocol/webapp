import { watch } from "vue";
import { useConnectionStore } from "@/common/stores/connection";

export function useWalletWatcher(
  onConnect: (address: string) => void | Promise<void>,
  onDisconnect: () => void | Promise<void>,
  onReconnect?: () => void | Promise<void>
): void {
  const connectionStore = useConnectionStore();
  watch(
    () => connectionStore.walletAddress,
    (newAddress, oldAddress) => {
      if (newAddress && newAddress !== oldAddress) {
        void onConnect(newAddress);
      } else if (!newAddress && oldAddress) {
        void onDisconnect();
      }
    },
    { immediate: true }
  );

  if (onReconnect) {
    watch(
      () => connectionStore.wsReconnectCount,
      () => {
        if (connectionStore.walletAddress) {
          void onReconnect();
        }
      }
    );
  }
}
