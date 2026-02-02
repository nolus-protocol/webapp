/**
 * Configuration types - matches backend/src/handlers/config.rs
 */

export interface AppConfigResponse {
  protocols: { [key: string]: ProtocolInfo };
  networks: NetworkInfo[];
  native_asset: NativeAssetInfo;
  contracts: ContractsInfo;
}

/**
 * Full currencies response from /api/currencies
 * Matches backend CurrenciesResponse
 */
export interface CurrenciesResponse {
  /** All currencies indexed by key (TICKER@PROTOCOL) */
  currencies: { [key: string]: CurrencyInfo };
  /** LPN currencies (one per protocol) */
  lpn: CurrencyInfo[];
  /** Lease-able currency tickers */
  lease_currencies: string[];
  /** Currency key mappings (aliases) */
  map: { [key: string]: string };
}

/**
 * Currency information matching frontend ExternalCurrency interface
 */
export interface CurrencyInfo {
  key: string;
  ticker: string;
  symbol: string;
  name: string;
  shortName: string;
  decimal_digits: number;
  ibcData: string;
  icon: string;
  native: boolean;
  coingeckoId: string | null;
  protocol: string;
  group: string;
}

export interface ProtocolInfo {
  name: string;
  network: string;
  dex: string;
  lpn: string;
  contracts: ProtocolContracts;
  active: boolean;
}

export interface ProtocolContracts {
  oracle: string;
  lpp: string;
  leaser: string;
  profit: string;
  reserve?: string;
}

export interface NetworkInfo {
  key: string;
  name: string;
  chain_id: string;
  prefix: string;
  rpc_url: string;
  rest_url: string;
  native_denom: string;
  gas_price: string;
  explorer: string;
}

export interface NativeAssetInfo {
  ticker: string;
  symbol: string;
  denom: string;
  decimal_digits: number;
}

export interface ContractsInfo {
  admin: string;
  dispatcher: string;
}
