import { watch } from "vue";
import { useConnectionStore } from "@/common/stores/connection";

export function useWalletWatcher(
  onConnect: (address: string) => void,
  onDisconnect: () => void,
  onReconnect?: () => void
): void {
  const connectionStore = useConnectionStore();
  watch(
    () => connectionStore.walletAddress,
    (newAddress, oldAddress) => {
      if (newAddress && newAddress !== oldAddress) {
        onConnect(newAddress);
      } else if (!newAddress && oldAddress) {
        onDisconnect();
      }
    },
    { immediate: true }
  );

  if (onReconnect) {
    watch(
      () => connectionStore.wsReconnectCount,
      () => {
        if (connectionStore.walletAddress) {
          onReconnect();
        }
      }
    );
  }
}
