import type { Store } from "../types";
import { Logger, WalletManager, WalletUtils } from "@/common/utils";
import { useApplicationStore } from "../../application";
import { CurrencyMapping } from "@/config/global";
import { AssetUtils, CurrencyUtils, NolusClient } from "@nolus/nolusjs";
import { Networks } from "@nolus/nolusjs/build/types/Networks";
import { coin } from "@cosmjs/amino";

export async function updateBalances(this: Store) {
  try {
    const walletAddress = WalletManager.getWalletAddress() ?? "";
    const ibcBalances = [];
    const app = useApplicationStore();
    const currencies = app.currenciesData;

    for (const key in currencies) {
      const currency = app.currenciesData![key];
      let shortName = currency.shortName;
      const [ticker, protocol] = key.split("@");

      if (CurrencyMapping[ticker as keyof typeof CurrencyMapping]) {
        shortName = CurrencyMapping[ticker as keyof typeof CurrencyMapping]?.name ?? shortName;
      }

      const ibcDenom = AssetUtils.makeIBCMinimalDenom(
        ticker,
        app.networksData as any,
        Networks.NOLUS,
        app.networksData?.protocols[protocol].DexNetwork as string
      );

      const fn = () => {
        const data = {
          ticker: key,
          shortName: shortName,
          name: currency.name,
          symbol: currency.symbol,
          decimal_digits: currency.decimal_digits,
          ibcData: ibcDenom
        };

        this.currencies[ibcDenom] = data;

        if (WalletUtils.isAuth()) {
          return NolusClient.getInstance()
            .getBalance(walletAddress, ibcDenom)
            .then((item) => {
              return {
                balance: CurrencyUtils.convertCosmosCoinToKeplCoin(item)
              };
            });
        }

        return {
          balance: CurrencyUtils.convertCosmosCoinToKeplCoin(coin("0", ibcDenom))
        };
      };

      ibcBalances.push(fn());
    }
    this.balances = await Promise.all(ibcBalances);
  } catch (e) {
    Logger.error(e);
    throw new Error(e as string);
  }
}
