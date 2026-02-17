/**
 * Price and balance types - matches backend/src/handlers/currencies.rs
 */

export interface PriceInfo {
  key: string;
  symbol: string;
  price_usd: string;
}

export interface PricesResponse {
  prices: { [key: string]: PriceInfo };
  updated_at: string;
}

/**
 * Transformed price data for store consumption
 */
export interface PriceData {
  [key: string]: {
    price: string;
    symbol: string;
  };
}

export interface BalanceInfo {
  key: string;
  symbol: string;
  denom: string;
  amount: string;
  amount_usd: string;
  decimal_digits: number;
}

export interface BalancesResponse {
  balances: BalanceInfo[];
  total_value_usd: string;
}
