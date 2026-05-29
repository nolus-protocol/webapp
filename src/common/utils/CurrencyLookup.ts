/**
 * CurrencyLookup - Currency lookup utilities
 *
 * Provides methods to look up currency information from the config store.
 * All functions delegate to useConfigStore which holds currencies data from the backend.
 */

import type { CurrencyInfo } from "@/common/api";
import { useConfigStore } from "../stores/config";
import { usePricesStore } from "../stores/prices";

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
 * Try to get currency by symbol, returns null instead of throwing
 */
export function tryGetCurrencyBySymbol(symbol: string): CurrencyInfo | null {
  const configStore = useConfigStore();
  return configStore.getCurrencyBySymbol(symbol) ?? null;
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
 * Resolve a currency's USD price string, with a network-aware fallback.
 *
 * The price feed is keyed by `TICKER@PROTOCOL`. Shared IBC denoms (e.g. USDC)
 * resolve via `tryGetCurrencyByDenom` to a single, arbitrary protocol entry
 * whose `key` may have no published price — which would otherwise default the
 * value to 0, display `$0.00`, and mis-sort the asset to the bottom of the
 * Swap/Deposit/Withdraw dropdowns. When the currency's own key is absent from
 * the feed, fall back to the network's primary-protocol key for the same
 * ticker — the same entry the Assets table resolves via
 * `getCurrencyByTickerForNetwork` — before finally defaulting to "0".
 *
 * Returns a decimal price string suitable for `new Dec(...)`.
 */
export function getPriceForCurrency(currency: CurrencyInfo): string {
  const pricesStore = usePricesStore();

  const direct = pricesStore.prices[currency.key]?.price;
  if (direct != null) {
    return direct;
  }

  const configStore = useConfigStore();
  const primary = configStore.getCurrencyByTickerForNetwork(currency.ticker, configStore.protocolFilter);
  if (primary && primary.key !== currency.key) {
    return pricesStore.prices[primary.key]?.price ?? "0";
  }

  return "0";
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
