import type { Store } from "../types";
import { getIgnoreAssets } from "@/common/utils/LeaseConfigService";
import { useBalancesStore } from "../../balances";

/**
 * Load ignored assets from config and store in balances store
 * 
 * This is a facade action - delegates to useBalancesStore
 */
export async function ignoreAssets(this: Store) {
  try {
    const ignored = await getIgnoreAssets();
    const balancesStore = useBalancesStore();
    balancesStore.setIgnoredCurrencies(ignored);
  } catch (error) {
    const balancesStore = useBalancesStore();
    balancesStore.setIgnoredCurrencies([]);
  }
}
