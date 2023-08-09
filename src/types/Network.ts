import type { ExternalCurrenciesType } from "./CurreciesType";

export interface Network {
  prefix: string;
  value: string;
  label: string;
  icon: string;
  ticker: string;
  native: boolean;
  estimation: number; 
  sourcePort: string;
  key: string;
  symbol: string;
}

export interface NetworkData{
  prefix: string,
  gasMuplttiplier: number,
  bip44Path: string,
  ibcTransferTimeout: number,
  ticker: string,
  name: string,
  gasPrice: string,
  explorer: string,
  key: string,
  currencies: () => ExternalCurrenciesType,
  embedChainInfo: Function,
  fees: {
      transfer_amount: number
  }
}