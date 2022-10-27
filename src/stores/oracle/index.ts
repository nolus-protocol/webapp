import type { State, Price as StatePrice } from '@/stores/oracle/state';
import { Dec } from '@keplr-wallet/unit';

import { defineStore } from 'pinia';
import { OracleActionTypes } from '@/stores/oracle/action-types';
import { EnvNetworkUtils } from '@/utils';
import { NolusClient } from '@nolus/nolusjs';
import { Oracle,  } from '@nolus/nolusjs/build/contracts';
import { CONTRACTS } from '@/config/contracts';
import { ASSETS } from '@/config/assetsInfo';

import CURRENCIES from '@/config/currencies.json';

const useOracleStore = defineStore('oracle', {
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

        const promises = [];
        const pricesState: { [key: string]: StatePrice } = {};

        for (const key in CURRENCIES.currencies) {
          const currency = CURRENCIES.currencies[key as keyof typeof CURRENCIES.currencies];
          promises.push(oracleContract.getPriceFor(
            currency.symbol
          ).then((price) => {
            const calculatedPrice = new Dec(price.amount.amount).quo(
              new Dec(price.amount_quote.amount)
            );
            //TODO check ticker
            const tokenPrice = {
              amount: calculatedPrice.toString(),
              symbol: price.amount_quote.ticker,
            };
            pricesState[currency.symbol] = tokenPrice;
          }).catch((error) => {
            pricesState[currency.symbol] = {
              amount: ASSETS[key as keyof typeof ASSETS].defaultPrice,
              symbol: currency.symbol
            };
          }));
        }

        await Promise.allSettled(promises);
        this.prices = pricesState;
      } catch (error: Error | any) {
        throw new Error(error);
      }
    },
  },
  getters: {},
});

export { useOracleStore, OracleActionTypes };
