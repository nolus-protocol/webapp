import type { State, Price as StatePrice } from '@/stores/oracle/state';
import { Dec } from '@keplr-wallet/unit';

import { defineStore } from 'pinia';
import { OracleActionTypes } from '@/stores/oracle/action-types';
import { EnvNetworkUtils } from '@/utils';
import { NolusClient } from '@nolus/nolusjs';
import { Oracle, type Price } from '@nolus/nolusjs/build/contracts';
import { CONTRACTS } from '@/config/contracts';
import { oracleDenoms } from '@/config/currencies';

const useOracleStore = defineStore('oracle', {
  state: () => {
    return {
      prices: null,
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
        const oraclePrices: Price[] = await oracleContract.getPricesFor(
          oracleDenoms
        );
        const pricesState: { [key: string]: StatePrice } = {};

        oraclePrices.forEach((price) => {
          const calculatedPrice = new Dec(price.amount.amount).quo(
            new Dec(price.amount_quote.amount)
          );
          const tokenPrice = {
            amount: calculatedPrice.toString(),
            symbol: price.amount_quote.symbol,
          };
          pricesState[price.amount.symbol] = tokenPrice;
        });

        this.prices = pricesState;
      } catch (error: Error | any) {
        throw new Error(error);
      }
    },
  },
  getters: {},
});

export { useOracleStore, OracleActionTypes };
