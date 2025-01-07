import type { ExternalCurrencies } from ".";

export interface Network {
  prefix: string;
  value: string;
  label: string;
  native: boolean;
  estimation: number;
  key: string;
  symbol: string;
  forward?: boolean;
  chain_type: ChainType;
  icon: string;
}

export interface EvmNetwork {
  estimation: { duration: number; type: string };
  explorer: string;
  fees: { transfer: number };
  gasMupltiplier: number;
  key: string;
  label: string;
  name: string;
  native: boolean;
  prefix: string;
  symbol: string;
  value: string;
  chain_type: ChainType;
  icon: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface NetworkData {
  prefix: string;
  gasMupltiplier: number;
  bip44Path: string;
  ibcTransferTimeout: number;
  ticker: string;
  name: string;
  gasPrice: string;
  explorer: string;
  key: string;
  currencies: () => ExternalCurrencies;
  embedChainInfo: Function;
  fees: {
    transfer_amount: number;
  };
}

export enum ChainType {
  cosmos = "cosmos",
  evm = "evm"
}
