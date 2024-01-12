export interface Price {
  amount: string;
  symbol: string;
}

export interface Prices {
  [key: string]: Price
}

export type State = {
  prices: Prices
};
