import type { Prices, State } from "../types";
import type { IObjectKeys } from "@/common/types";
import { NolusClient } from "@nolus/nolusjs";
import { useApplicationStore } from "../../application";
import { useAdminStore } from "../../admin";
import { Oracle } from "@nolus/nolusjs/build/contracts";
import { LPN_DECIMALS, LPN_PRICE, isProtocolInclude } from "@/config/global";
import { Dec } from "@keplr-wallet/unit";
import { CurrencyDemapping } from "@/config/currencies";

export async function getPrices(this: State) {
  try {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();

    const app = useApplicationStore();
    const admin = useAdminStore();

    const pr: Prices = {};
    const promises = [];

    for (const protocolKey in admin.contracts) {
      const fn = async () => {
        const protocol = admin.contracts![protocolKey];
        const oracleContract = new Oracle(cosmWasmClient, protocol.oracle);

        const data = (await oracleContract.getPrices()) as IObjectKeys;

        const tst = await oracleContract.getCurrencies();

        for (const price of data.prices) {
          const ticker = CurrencyDemapping[price.amount.ticker]?.ticker ?? price.amount.ticker;
          const present = isProtocolInclude(ticker);
          const currency = app.currenciesData![`${ticker}@${protocolKey}`];

          if (currency && (present.length == 0 || present.includes(protocolKey))) {
            const diff = Math.abs(Number(currency.decimal_digits) - LPN_DECIMALS);
            let calculatedPrice = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));
            calculatedPrice = calculatedPrice.mul(new Dec(10 ** diff));
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

    for (const lpn of app.lpn ?? []) {
      pr[lpn.ibcData as string] = { symbol: lpn.ticker as string, amount: `${LPN_PRICE}` };
    }

    await Promise.all(promises);
    this.prices = pr;
  } catch (error: Error | any) {
    throw new Error(error);
  }
}
