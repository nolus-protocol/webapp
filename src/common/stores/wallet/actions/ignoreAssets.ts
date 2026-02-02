import type { Store } from "../types";
import { getIgnoreAssets } from "@/common/utils/LeaseConfigService";

export async function ignoreAssets(this: Store) {
  try {
    this.ignoreCurrencies = await getIgnoreAssets();
  } catch (error) {
    this.ignoreCurrencies = [];
  }
}
