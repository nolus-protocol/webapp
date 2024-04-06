import type { State } from "../types";
import { NATIVE_ASSET } from "@/config/global";
import { useApplicationStore } from "../../application";
import { AppUtils } from "@/common/utils";
import { ASSETS, CurrencyMapping } from "@/config/currencies";

//TODO: delete or refactor
export function getCurrencyInfo(state: State) {
  return (denom: string) => {
    const currency = state.currencies[denom];

    const app = useApplicationStore();
    const assetIcons = app.assetIcons!;

    if (!currency) {
      return {
        ticker: NATIVE_ASSET.ticker as string,
        shortName: NATIVE_ASSET.label as string,
        coinDenom: NATIVE_ASSET.label as string,
        coinMinimalDenom: NATIVE_ASSET.denom as string,
        coinDecimals: Number(0),
        coinAbbreviation: NATIVE_ASSET.label as string,
        coinGeckoId: ASSETS.NLS.coinGeckoId,
        coinIcon: NATIVE_ASSET.icon as string,
        key: `${app.native?.ticker}@${AppUtils.getProtocols().osmosis}`
      };
    }

    const [ticker] = (currency?.ticker ?? "").split("@");
    const mappedTicker = CurrencyMapping[ticker as keyof typeof CurrencyMapping]?.ticker;

    return {
      ticker: mappedTicker ?? ticker,
      shortName: currency.shortName,
      coinDenom: currency.name,
      coinMinimalDenom: denom,
      coinDecimals: Number(currency.decimal_digits),
      coinAbbreviation: currency.name,
      coinGeckoId: ASSETS[(mappedTicker ?? ticker) as keyof typeof ASSETS].coinGeckoId,
      coinIcon: assetIcons[currency?.ticker],
      key: currency?.ticker
    };
  };
}
