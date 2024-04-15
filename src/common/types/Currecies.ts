import type { Coin as UnitCoin, Dec } from "@keplr-wallet/unit";

export interface Currecies {
  amm_pools: {
    id: string;
    token_0: string;
    token_1: string;
  }[];
  currencies: {
    [key: string]: {
      name: string;
      symbol: string;
      decimal_digits: string;
      ibc_route: string[];
      groups: string[];
      swap_routes: Array<
        {
          pool_id: string;
          pool_token: string;
        }[]
      >;
    };
  };
}

export interface ExternalCurrency {
  name: string;
  shortName: string;
  symbol: string;
  decimal_digits: number;
  ticker: string;
  native: boolean;
  key: string;
  ibcData: string;
  icon: string;
  coingeckoId: string;
  balance?: UnitCoin | any;
}

export interface ExternalCurrencies {
  [key: string]: ExternalCurrency;
}

export enum CURRENCY_VIEW_TYPES {
  TOKEN = "TOKEN",
  CURRENCY = "CURRENCY"
}
