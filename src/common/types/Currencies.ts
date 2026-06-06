export interface CoinBalance {
  denom: string;
  amount: string;
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
  coingeckoId: string | null;
  balance?: CoinBalance;
}

export interface ExternalCurrencies {
  [key: string]: ExternalCurrency;
}
