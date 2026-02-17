/**
 * CurrencyLookup - Currency lookup utilities
 *
 * Provides methods to look up currency information from the config store.
 * All functions delegate to useConfigStore which holds currencies data from the backend.
 */

import type { CurrencyInfo } from "@/common/api";
import { useConfigStore } from "../stores/config";

/**
 * Get currency by denom and protocol
 */
export function getCurrency(denom: string, protocol: string): CurrencyInfo {
  const configStore = useConfigStore();
  const currency = configStore.getCurrency(denom, protocol);

  if (!currency) {
    throw new Error(`Currency not found: ${denom} ${protocol}`);
  }

  return currency;
}

/**
 * Get currency by ticker
 */
export function getCurrencyByTicker(ticker: string): CurrencyInfo {
  const configStore = useConfigStore();
  const currency = configStore.getCurrencyByTicker(ticker);

  if (!currency) {
    throw new Error(`Currency not found: ${ticker}`);
  }

  return currency;
}

/**
 * Get currency by symbol
 */
export function getCurrencyBySymbol(symbol: string): CurrencyInfo {
  const configStore = useConfigStore();
  const currency = configStore.getCurrencyBySymbol(symbol);

  if (!currency) {
    throw new Error(`Currency not found: ${symbol}`);
  }

  return currency;
}

/**
 * Get currency by IBC denom
 */
export function getCurrencyByDenom(denom: string): CurrencyInfo {
  const configStore = useConfigStore();
  const currency = configStore.getCurrencyByDenom(denom);

  if (!currency) {
    throw new Error(`Currency not found: ${denom}`);
  }

  return currency;
}

/**
 * Get LPN (Liquidity Pool Native) currency by protocol
 * Returns null if not found (caller should handle)
 */
export function getLpnByProtocol(protocol: string): CurrencyInfo | null {
  const configStore = useConfigStore();
  return configStore.getLpnByProtocol(protocol);
}

/**
 * Get protocol name by contract address
 */
export function getProtocolByContract(contract: string): string {
  const configStore = useConfigStore();
  const protocol = configStore.getProtocolByContract(contract);

  if (!protocol) {
    throw new Error(`Contract not found ${contract}`);
  }

  return protocol;
}

/**
 * Try to get currency by denom, returns null instead of throwing
 */
export function tryGetCurrencyByDenom(denom: string): CurrencyInfo | null {
  const configStore = useConfigStore();
  return configStore.tryGetCurrencyByDenom(denom);
}

/**
 * Get currency by ticker for a specific protocol.
 * Constructs the key as "ticker@protocol" and looks up by key.
 * Used by lease/earn/history contexts where the protocol is known.
 */
export function getCurrencyByTickerForProtocol(ticker: string, protocol: string): CurrencyInfo {
  const configStore = useConfigStore();
  const key = `${ticker}@${protocol}`;
  const currency = configStore.getCurrencyByKey(key);

  if (!currency) {
    throw new Error(`Currency not found: ${ticker} for protocol ${protocol}`);
  }

  return currency;
}

/**
 * Get currency by ticker for the current network filter.
 * Prefers protocols belonging to the selected network.
 * Used by asset display, swap, and receive contexts.
 */
export function getCurrencyByTickerForNetwork(ticker: string): CurrencyInfo {
  const configStore = useConfigStore();
  const currency = configStore.getCurrencyByTickerForNetwork(ticker, configStore.protocolFilter);

  if (!currency) {
    throw new Error(`Currency not found: ${ticker} for network ${configStore.protocolFilter}`);
  }

  return currency;
}
