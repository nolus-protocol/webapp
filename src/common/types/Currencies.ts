import type { Coin as UnitCoin } from "@keplr-wallet/unit";

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
  coingeckoId: string | null;
  balance?: UnitCoin;
}

export interface ExternalCurrencies {
  [key: string]: ExternalCurrency;
}
