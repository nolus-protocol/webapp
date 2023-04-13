import type { State, Price as StatePrice } from "@/stores/oracle/state";
import { Dec } from "@keplr-wallet/unit";

import { defineStore } from "pinia";
import { OracleActionTypes } from "@/stores/oracle/action-types";
import { EnvNetworkUtils } from "@/utils";
import { NolusClient } from "@nolus/nolusjs";
import { Oracle } from "@nolus/nolusjs/build/contracts";
import { CONTRACTS } from "@/config/contracts";
import { ASSETS } from "@/config/assetsInfo";

import CURRENCIES from "@/config/currencies.json";
import { LPN_CURRENCIES } from "@/config/env";

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
        const oracleContract = new Oracle(
          cosmWasmClient,
          CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].oracle.instance
        );

        const data: {
          prices: {
            amount: {
              amount: string,
              ticker: string
            },
            amount_quote: {
              amount: string,
              ticker: string
            }
          }[]
        } = await oracleContract.getPricesFor([]) as any;
        for (const price of data.prices) {
          const key = price.amount.ticker;
          const currency = CURRENCIES.currencies[key as keyof typeof CURRENCIES.currencies];
          const diff = Math.abs(
            Number(
              CURRENCIES.currencies[
                key as keyof typeof CURRENCIES.currencies
              ].decimal_digits
            ) - Number(CURRENCIES.currencies.USDC.decimal_digits)
          );
          let calculatedPrice = new Dec(price.amount_quote.amount).quo(
            new Dec(price.amount.amount)
          );
          calculatedPrice = calculatedPrice.mul(new Dec(10 ** diff));
          const tokenPrice = {
            amount: calculatedPrice.toString(),
            symbol: price.amount_quote.ticker,
          };
          this.prices[currency.symbol] = tokenPrice;
        }

        for (const currency of LPN_CURRENCIES) {
          const c = CURRENCIES.currencies[currency as keyof typeof CURRENCIES.currencies];
          this.prices[c.symbol] = { symbol: currency, amount: ASSETS[currency as keyof typeof ASSETS].defaultPrice };
        }

      } catch (error: Error | any) {
        throw new Error(error);
      }
    },
  },
  getters: {},
});

export { useOracleStore, OracleActionTypes };
