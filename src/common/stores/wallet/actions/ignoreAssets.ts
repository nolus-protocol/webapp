import type { Store } from "../types";
import { useBalancesStore } from "../../balances";

/**
 * Initialize ignored assets in balances store
 *
 * Note: Asset filtering (ignore_all, ignore_long, ignore_short) is now
 * handled by the backend in /api/protocols/{protocol}/currencies endpoint.
 * This action now just initializes the local state as empty.
 */
export async function ignoreAssets(this: Store) {
  const balancesStore = useBalancesStore();
  balancesStore.setIgnoredCurrencies([]);
}
