import type { Price, State } from "@/stores/oracle/state";
import { Dec } from "@keplr-wallet/unit";

import { defineStore } from "pinia";
import { OracleActionTypes } from "@/stores/oracle/action-types";
import { EnvNetworkUtils } from "@/utils";
import { NolusClient } from "@nolus/nolusjs";
import { Oracle } from "@nolus/nolusjs/build/contracts/clients/Oracle";
import { CONTRACTS } from "@/config/contracts";

import { LPN_DECIMALS, LPN_PRICE } from "@/config/env";
import { useApplicationStore } from "../application";

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
        const app = useApplicationStore()
        const pr: {
          [key: string]: Price
        } = {};

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
          }[];
        } = await oracleContract.getPrices() as any;

        for (const price of data.prices) {
          const key = price.amount.ticker;
          const currency = app.getCurrencySymbol(key);

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
            pr[currency.symbol] = tokenPrice;
          }
          for (const lpn of app.lpn ?? []) {
            pr[lpn.symbol] = { symbol: lpn.ticker as string, amount: `${LPN_PRICE}` };
          }
        }

        this.prices = pr;

      } catch (error: Error | any) {
        console.log(error)
        throw new Error(error);
      }
    },
  },
  getters: {},
});

export { useOracleStore, OracleActionTypes };
