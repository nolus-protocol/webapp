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
  sourceChannel: string;
  key: string;
}

export interface NetworkData{
  prefix: string,
  tendermintRpc: string,
  api: string,
  sourceChannel: string,
  gasMuplttiplier: number,
  bip44Path: string,
  ibcTransferTimeout: number,
  ticker: string,
  name: string,
  gasPrice: string,
  explorer: string,
  currencies: () => Promise<ExternalCurrenciesType>,
  embedChainInfo: Function,
  fees: {
      transfer_amount: number
  }
}