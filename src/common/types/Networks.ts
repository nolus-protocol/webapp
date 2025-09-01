import type { ExternalCurrency } from "./";

export type Networks = "testnet" | "mainnet" | "devnet";
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

export interface CurrencyDefinition {
  name: string;
  shortName: string;
  symbol: string;
  coinGeckoId: string;
}

export interface CurrenciesConfig {
  icons: string;
  currencies: Record<string, CurrencyDefinition>;
  map: {
    [key: string]: string;
  };
}

export const MAINNET_NAME = "mainnet";
