import { computed } from "vue";
import { useWalletStore } from "@/common/stores/wallet";

export function useWalletConnected() {
  const wallet = useWalletStore();
  return computed(() => !!wallet.wallet);
}
