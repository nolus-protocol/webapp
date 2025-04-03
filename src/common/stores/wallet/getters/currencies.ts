import type { State } from "../types";
import type { ExternalCurrency } from "@/common/types";
import { Logger, AssetUtils } from "@/common/utils";
import { useApplicationStore } from "../../application";
import { Contracts, NATIVE_ASSET } from "@/config/global";

export function currencies(state: State) {
  const b: ExternalCurrency[] = [];
  const app = useApplicationStore();
  const protocols = Contracts.protocolsFilter[app.protocolFilter];
  try {
    for (const c of state.balances) {
      let asset = AssetUtils.getCurrencyByDenom(c.balance.denom);
      const [k, _p] = asset.key.split("@");

      if (k == NATIVE_ASSET.ticker) {
        asset = app.currenciesData![protocols.native];
      }

      const [_, pr] = asset.key.split("@");

      if (!state.ignoreCurrencies.includes(asset.ticker as string) && protocols.hold.includes(pr)) {
        b.push({ ...asset, balance: c.balance });
      }
    }
  } catch (e) {
    Logger.error(e);
  }

  return b;
}
