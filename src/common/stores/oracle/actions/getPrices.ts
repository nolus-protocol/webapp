import type { Prices, State } from "../types";
import type { IObjectKeys } from "@/common/types";
import { NolusClient } from "@nolus/nolusjs";
import { useApplicationStore } from "../../application";
import { useAdminStore } from "../../admin";
import { Oracle } from "@nolus/nolusjs/build/contracts";
import { Dec } from "@keplr-wallet/unit";
import { CurrencyDemapping } from "@/config/currencies";
import { AssetUtils } from "@/common/utils";
import { Contracts } from "@/config/global";

export async function getPrices(this: State) {
  try {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();

    const app = useApplicationStore();
    const admin = useAdminStore();

    const pr: Prices = {};
    const promises = [];

    for (const protocolKey in admin.contracts) {
      if (Contracts.protocolsFilter[app.protocolFilter].hold.includes(protocolKey)) {
        const fn = async () => {
          const protocol = admin.contracts![protocolKey];
          const oracleContract = new Oracle(cosmWasmClient, protocol.oracle);

          const [data, lpnPrice] = await Promise.all([oracleContract.getPrices(), getLpnPrice(oracleContract)]);
          const lpn = AssetUtils.getLpnByProtocol(protocolKey);
          const baseCurrency = app.currenciesData![`${lpnPrice.amount_quote}@${protocolKey}`];
          const decimals = lpn.decimal_digits - baseCurrency.decimal_digits;
          lpnPrice.price = lpnPrice.price.mul(new Dec(10 ** decimals));
          pr[lpn.ibcData as string] = { symbol: lpn.ticker as string, amount: lpnPrice.price.toString() };
          pr[lpn.key as string] = { symbol: lpn.ticker as string, amount: lpnPrice.price.toString() };

          for (const price of (data as IObjectKeys).prices) {
            const ticker = CurrencyDemapping[price.amount.ticker]?.ticker ?? price.amount.ticker;
            const currency = app.currenciesData![`${ticker}@${protocolKey}`];
            if (currency) {
              const diff = currency.decimal_digits - lpn.decimal_digits;
              let calculatedPrice = new Dec(price.amount_quote.amount)
                .quo(new Dec(price.amount.amount))
                .mul(lpnPrice.price)
                .mul(new Dec(10 ** diff));
              const tokenPrice = {
                amount: calculatedPrice.toString(),
                symbol: price.amount_quote.ticker
              };
              pr[currency.ibcData as string] = tokenPrice;
              pr[currency.key as string] = tokenPrice;
            }
          }
        };
        promises.push(fn());
      }
    }

    await Promise.all(promises);
    this.prices = pr;
  } catch (error: Error | any) {
    throw new Error(error);
  }
}

async function getLpnPrice(oracleContract: Oracle) {
  const lpn = await oracleContract.getBaseCurrency();
  const price = await oracleContract.getStablePrice(lpn);
  return {
    price: new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount)),
    amount_quote: CurrencyDemapping[price.amount_quote.ticker!]?.ticker ?? price.amount_quote.ticker
  };
}
