export enum OracleActions {
  GET_PRICES = "GET_PRICES"
}

export interface Price {
  amount: string;
  symbol: string;
}

export interface Prices {
  [key: string]: Price;
}

export type State = {
  prices: Prices;
};

export type Store = ReturnType<(typeof import(".."))["useOracleStore"]>; // (3)
