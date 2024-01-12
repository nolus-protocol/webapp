import type { Prices, State } from "@/stores/oracle/state";

import { Dec } from "@keplr-wallet/unit";
import { defineStore } from "pinia";
import { OracleActionTypes } from "@/stores/oracle/action-types";
import { NolusClient } from "@nolus/nolusjs";
import { Oracle } from "@nolus/nolusjs/build/contracts/clients/Oracle";

import { LPN_DECIMALS, LPN_PRICE } from "@/config/env";
import { useApplicationStore } from "../application";
import { useAdminStore } from "../admin";

const useOracleStore = defineStore("oracle", {
  state: () => {
    return {
      prices: {},
    } as State;
  },
  actions: {
    async [OracleActionTypes.GET_PRICES]() {
      try {
        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();

        const app = useApplicationStore();
        const admin = useAdminStore();

        const pr: Prices = {};

        const promises = [];

        for (const protocolKey in admin.contracts) {

          const fn = async () => {
            const protocol = admin.contracts[protocolKey];

            const oracleContract = new Oracle(
              cosmWasmClient,
              protocol.oracle
            );

            const data = await oracleContract.getPrices() as any;
            for (const price of data.prices) {
              const key = price.amount.ticker;
              const currency = app.getCurrencySymbol(key, protocolKey);
              if (currency) {
                const diff = Math.abs(
                  Number(
                    currency.decimal_digits
                  ) - LPN_DECIMALS
                );
                let calculatedPrice = new Dec(price.amount_quote.amount).quo(
                  new Dec(price.amount.amount)
                );
                calculatedPrice = calculatedPrice.mul(new Dec(10 ** diff));
                const tokenPrice = {
                  amount: calculatedPrice.toString(),
                  symbol: price.amount_quote.ticker,
                };
                pr[currency.ibcData as string] = tokenPrice;
                pr[currency.key as string] = tokenPrice;
              }
            }
          }

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
    },
  },
  getters: {},
});

export { useOracleStore, OracleActionTypes };
