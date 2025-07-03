import type { Store } from "../types";
import { Logger, WalletManager, WalletUtils } from "@/common/utils";
import { useApplicationStore } from "../../application";
import { CurrencyUtils, NolusClient } from "@nolus/nolusjs";
import { coin } from "@cosmjs/amino";
import { NATIVE_ASSET, ProtocolsConfig } from "@/config/global";

export async function updateBalances(this: Store) {
  try {
    const walletAddress = WalletManager.getWalletAddress() ?? "";
    const ibcBalances = [];
    const app = useApplicationStore();
    const currencies = app.currenciesData;
    const set = new Set();

    for (const key in currencies) {
      const currency = app.currenciesData![key];
      let shortName = currency.shortName;
      const [ticker, protocol] = key.split("@");

      if (!ProtocolsConfig[protocol].currencies.includes(ticker)) {
        continue;
      }

      const ibcDenom = currency.ibcData;

      if (set.has(ibcDenom)) {
        continue;
      }

      set.add(ibcDenom);

      const fn = () => {
        if (WalletUtils.isAuth()) {
          return NolusClient.getInstance()
            .getSpendableBalance(walletAddress, ibcDenom)
            .then((item) => {
              return {
                balance: CurrencyUtils.convertCosmosCoinToKeplCoin(item.balance)
              };
            });
        }

        return {
          balance: CurrencyUtils.convertCosmosCoinToKeplCoin(coin("0", ibcDenom))
        };
      };
      ibcBalances.push(fn());
    }

    const [nativeTotal, ...balances] = await Promise.all([getNativeTotal(walletAddress), ...ibcBalances]);
    this.balances = balances;
    this.total_unls = nativeTotal;
  } catch (e) {
    Logger.error(e);
    throw new Error(e as string);
  }
}

async function getNativeTotal(walletAddress: string) {
  if (WalletUtils.isAuth()) {
    return NolusClient.getInstance()
      .getBalance(walletAddress, NATIVE_ASSET.denom)
      .then((item) => {
        return {
          balance: CurrencyUtils.convertCosmosCoinToKeplCoin(item)
        };
      });
  }
  return {
    balance: CurrencyUtils.convertCosmosCoinToKeplCoin(coin("0", NATIVE_ASSET.denom))
  };
}
