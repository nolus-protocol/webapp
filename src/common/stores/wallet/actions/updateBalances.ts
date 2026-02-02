import type { Store } from "../types";
import { Logger, WalletManager, WalletUtils } from "@/common/utils";
import { useBalancesStore } from "../../balances";

/**
 * Update balances - delegates to useBalancesStore
 * 
 * This is a facade action that calls the balances store.
 * Components should migrate to using useBalancesStore.fetchBalances() directly.
 */
export async function updateBalances(this: Store) {
  try {
    const walletAddress = WalletManager.getWalletAddress() ?? "";
    
    if (!WalletUtils.isAuth() || !walletAddress) {
      const balancesStore = useBalancesStore();
      balancesStore.clear();
      return;
    }

    const balancesStore = useBalancesStore();
    
    // Set the address if it changed, this will fetch balances automatically
    if (balancesStore.address !== walletAddress) {
      await balancesStore.setAddress(walletAddress);
    } else {
      // Just refresh the balances
      await balancesStore.fetchBalances();
    }
  } catch (e) {
    Logger.error(e);
    throw new Error(e as string);
  }
}
