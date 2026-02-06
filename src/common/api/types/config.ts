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
 * Raw currency info from backend (snake_case)
 */
export interface RawCurrencyInfo {
  key: string;
  ticker: string;
  symbol: string;
  name: string;
  short_name: string;
  decimal_digits: number;
  bank_symbol: string;
  dex_symbol: string;
  icon: string;
  native: boolean;
  coingecko_id: string | null;
  protocol: string;
  group: string;
  is_active: boolean;
}

/**
 * Raw currencies response from backend (snake_case)
 */
export interface RawCurrenciesResponse {
  currencies: { [key: string]: RawCurrencyInfo };
  lpn: RawCurrencyInfo[];
  lease_currencies: string[];
  map: { [key: string]: string };
}

/**
 * Full currencies response from /api/currencies
 * Transformed to camelCase for frontend use
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
 * Transformed from backend snake_case to camelCase
 */
export interface CurrencyInfo {
  key: string;
  ticker: string;
  symbol: string;
  name: string;
  shortName: string;
  decimal_digits: number;
  ibcData: string;
  dexSymbol: string;
  icon: string;
  native: boolean;
  coingeckoId: string | null;
  protocol: string;
  group: string;
  isActive: boolean;
}

/**
 * Transform raw currency info from backend to frontend format
 */
export function transformCurrencyInfo(raw: RawCurrencyInfo): CurrencyInfo {
  return {
    key: raw.key,
    ticker: raw.ticker,
    symbol: raw.symbol,
    name: raw.name,
    shortName: raw.short_name,
    decimal_digits: raw.decimal_digits,
    ibcData: raw.bank_symbol,
    dexSymbol: raw.dex_symbol,
    icon: raw.icon,
    native: raw.native,
    coingeckoId: raw.coingecko_id,
    protocol: raw.protocol,
    group: raw.group,
    isActive: raw.is_active
  };
}

/**
 * Transform raw currencies response to frontend format
 */
export function transformCurrenciesResponse(raw: RawCurrenciesResponse): CurrenciesResponse {
  const currencies: { [key: string]: CurrencyInfo } = {};
  for (const [key, value] of Object.entries(raw.currencies)) {
    currencies[key] = transformCurrencyInfo(value);
  }

  return {
    currencies,
    lpn: raw.lpn.map(transformCurrencyInfo),
    lease_currencies: raw.lease_currencies,
    map: raw.map
  };
}

export interface ProtocolInfo {
  name: string;
  network: string | null;
  dex: string | null;
  lpn: string;
  position_type: string;
  contracts: ProtocolContracts;
  is_active: boolean;
}

export interface ProtocolContracts {
  oracle: string | null;
  lpp: string;
  leaser: string | null;
  profit: string | null;
  reserve?: string | null;
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
  symbol: string;
  value: string;
  native: boolean;
  estimation?: number;
  estimation_duration?: number;
  estimation_type?: string;
  forward?: boolean;
  chain_type: string;
  icon: string;
  gas_multiplier: number;
  fees_transfer?: number;
  native_currency_name?: string;
  native_currency_symbol?: string;
  native_currency_decimals?: number;
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

/**
 * Gas fee configuration from /api/fees/gas-config
 * Contains accepted fee denoms with min gas prices and the gas multiplier.
 */
export interface GasFeeConfigResponse {
  gas_prices: { [denom: string]: string };
  gas_multiplier: number;
}

/**
 * Gated network info from /api/networks/gated
 * Matches backend GatedNetworkInfo
 */
export interface GatedNetworkInfo {
  network: string;
  name: string;
  chain_id: string;
  prefix: string;
  rpc: string;
  lcd: string;
  fallback_rpc?: string[];
  fallback_lcd?: string[];
  gas_price: string;
  explorer: string;
  icon: string;
  primaryProtocol?: string;
  estimation?: number;
}

export interface GatedNetworksResponse {
  networks: GatedNetworkInfo[];
  count: number;
}

/**
 * Asset info from /api/assets
 * Provides deduplicated assets with network/protocol mappings
 */
export interface AssetInfo {
  ticker: string;
  decimals: number;
  icon: string;
  displayName: string;
  shortName: string;
  color: string;
  coingeckoId: string | null;
  price: string;
  networks: string[];
  protocols: string[];
}

export interface AssetsResponse {
  assets: AssetInfo[];
  count: number;
}

/**
 * LPN display info for gated protocols
 */
export interface LpnDisplayInfo {
  ticker: string;
  icon: string;
  displayName: string;
  shortName: string;
  color?: string;
}

/**
 * Protocol contracts info
 */
export interface GatedProtocolContracts {
  leaser: string | null;
  lpp: string;
  oracle: string | null;
  profit: string | null;
  reserve?: string | null;
}

/**
 * Gated protocol info from /api/protocols/gated
 */
export interface GatedProtocolInfo {
  protocol: string;
  network: string;
  dex: string;
  position_type: "Long" | "Short";
  lpn: string;
  lpn_display: LpnDisplayInfo;
  contracts: GatedProtocolContracts;
}

export interface GatedProtocolsResponse {
  protocols: GatedProtocolInfo[];
  count: number;
}

/**
 * Currency info from /api/protocols/{protocol}/currencies
 */
export interface ProtocolCurrencyInfo {
  ticker: string;
  decimals: number;
  icon: string;
  displayName: string;
  shortName: string;
  color?: string;
  bank_symbol: string;
  dex_symbol: string;
  group: "lease" | "lpn" | "native" | "collateral";
  price?: string;
}

export interface ProtocolCurrenciesResponse {
  protocol: string;
  currencies: ProtocolCurrencyInfo[];
  count: number;
}
