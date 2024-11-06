import type { State } from "../types";
import type { ExternalCurrency } from "@/common/types";
import { Logger, AssetUtils } from "@/common/utils";

export function currencies(state: State) {
  const b: ExternalCurrency[] = [];

  try {
    for (const c of state.balances) {
      const asset = AssetUtils.getCurrencyByDenom(c.balance.denom);
      if (!state.ignoreCurrencies.includes(asset.ticker as string)) {
        b.push({ ...asset, balance: c.balance });
      }
    }
  } catch (e) {
    Logger.error(e);
  }

  return b;
}
