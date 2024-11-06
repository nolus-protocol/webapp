import type { Store } from "../types";
import { AppUtils } from "@/common/utils";

export async function ignoreAssets(this: Store) {
  try {
    this.ignoreCurrencies = await AppUtils.getIgnoreAssets();
  } catch (error) {
    this.ignoreCurrencies = [];
  }
}
