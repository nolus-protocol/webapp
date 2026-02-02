/**
 * Webapp Configuration types - matches backend/src/config_store/types.rs
 */

export interface WebappCurrenciesConfig {
  icons: string;
  currencies: Record<string, WebappCurrencyInfo>;
  map: Record<string, string>;
}

export interface WebappCurrencyInfo {
  name: string;
  short_name: string;
  coin_gecko_id: string;
  symbol: string;
}

export interface WebappChainIdsConfig {
  cosmos: Record<string, string>;
  evm: Record<string, string>;
}

export interface WebappNetworkEndpointsConfig {
  prefix: string;
  chainId: string;
  api: string[];
  rpc: string[];
  explorer: string;
  govern: string;
  staking: string;
  etf_api?: string;
  gasMutiplier?: number;
  native: boolean;
  key: string;
  protocols: Record<string, unknown>;
  currencies: string[];
  evmCurrencies?: string[];
  ibcTransferTimeout?: number;
}

export interface WebappEndpointsCollection {
  pirin: WebappNetworkEndpointsConfig;
  rila: WebappNetworkEndpointsConfig;
  evm: WebappNetworkEndpointsConfig;
}

export interface WebappDownpaymentRange {
  min: number;
  max: number;
}

export interface WebappDownpaymentRangesConfig {
  protocols: Record<string, WebappDownpaymentRange>;
}

export interface WebappLeaseConfig {
  downpayment_ranges: WebappDownpaymentRangesConfig;
  ignore_assets: string[];
  ignore_lease_long: string[];
  ignore_lease_short: string[];
  free_interest_assets: string[];
  due_projection: WebappDueProjectionConfig;
}

export interface WebappDueProjectionConfig {
  seconds: number;
}

export interface WebappZeroInterestAddresses {
  interest_paid_to: string[];
}

export interface WebappSkipRouteConfig {
  [key: string]: unknown;
}

export interface WebappProposalsConfig {
  hidden_ids: number[];
}

export interface WebappHistoryCurrenciesConfig {
  currencies: Record<string, string>;
}

export interface WebappHistoryProtocolsConfig {
  protocols: Record<string, string>;
}

export interface WebappFullConfig {
  currencies: WebappCurrenciesConfig;
  chain_ids: WebappChainIdsConfig;
  endpoints: WebappEndpointsCollection;
  lease: WebappLeaseConfig;
  zero_interest: WebappZeroInterestAddresses;
  skip_route: WebappSkipRouteConfig;
  governance: WebappProposalsConfig;
  history_currencies: WebappHistoryCurrenciesConfig;
  history_protocols: WebappHistoryProtocolsConfig;
}

export interface WebappLocalesListResponse {
  available: string[];
  default: string;
}
