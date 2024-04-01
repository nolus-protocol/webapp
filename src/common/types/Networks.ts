import type { ExternalCurrency } from "./";

export type Networks = "testnet" | "mainnet";
export interface NetworksInfo {
  [key: string]: {
    [key: string]: ExternalCurrency;
  };
}

export interface Currency {
  native?: {
    name: string;
    ticker: string;
    symbol: string;
    decimal_digits: number;
  };
  ibc?: {
    network: string;
    currency: string;
  };
  ibcData: string;
  icon?: string;
  forward?: string[];
}
