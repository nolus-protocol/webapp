/**
 * CurrencyLookup - Currency lookup utilities
 *
 * Provides methods to look up currency information from the application store.
 */

import type { ExternalCurrency } from "@/common/types";
import { useApplicationStore } from "../stores/application";
import { useConfigStore } from "../stores/config";

/**
 * Get currency by denom and protocol
 */
export function getCurrency(denom: string, protocol: string): ExternalCurrency {
  const application = useApplicationStore();

  for (const key in application.currenciesData) {
    const [_ticker, pr] = application.currenciesData[key].key.split("@");
    if (application.currenciesData[key].ibcData === denom && protocol === pr) {
      return application.currenciesData[key];
    }
  }

  throw new Error(`Currency not found: ${denom} ${protocol}`);
}

/**
 * Get currency by ticker
 */
export function getCurrencyByTicker(ticker: string): ExternalCurrency {
  const application = useApplicationStore();

  for (const key in application.currenciesData) {
    const [t] = key.split("@");
    if (t === ticker) {
      return application.currenciesData[key];
    }
  }

  throw new Error(`Currency not found: ${ticker}`);
}

/**
 * Get currency by symbol
 */
export function getCurrencyBySymbol(symbol: string): ExternalCurrency {
  const application = useApplicationStore();

  for (const key in application.currenciesData) {
    if (application.currenciesData[key].symbol === symbol) {
      return application.currenciesData[key];
    }
  }

  throw new Error(`Currency not found: ${symbol}`);
}

/**
 * Get currency by IBC denom
 */
export function getCurrencyByDenom(denom: string): ExternalCurrency {
  const application = useApplicationStore();

  for (const key in application.currenciesData) {
    if (denom === application.currenciesData[key].ibcData) {
      return application.currenciesData[key];
    }
  }

  throw new Error(`Currency not found: ${denom}`);
}

/**
 * Get native currency
 */
export function getNativeCurrency(): ExternalCurrency {
  const app = useApplicationStore();

  for (const c in app.currenciesData) {
    if (app.currenciesData[c].native) {
      return app.currenciesData[c];
    }
  }

  throw new Error(`Native currency not found`);
}

/**
 * Get LPN (Liquidity Pool Native) currency by protocol
 * Returns null if not found (caller should handle)
 */
export function getLpnByProtocol(protocol: string): ExternalCurrency | null {
  const app = useApplicationStore();

  for (const lpn of app.lpn ?? []) {
    if (!lpn?.key) continue;
    const [, p] = lpn.key.split("@");
    if (p === protocol) {
      return lpn;
    }
  }

  return null;
}

/**
 * Get protocol name by contract address
 */
export function getProtocolByContract(contract: string): string {
  const configStore = useConfigStore();

  for (const protocol in configStore.contracts) {
    const contracts = configStore.contracts[protocol];
    for (const key in contracts) {
      const p = contracts[key as keyof typeof contracts];
      if (p === contract) {
        return protocol;
      }
    }
  }

  throw new Error(`Contract not found ${contract}`);
}

/**
 * Try to get currency by denom, returns null instead of throwing
 */
export function tryGetCurrencyByDenom(denom: string): ExternalCurrency | null {
  try {
    return getCurrencyByDenom(denom);
  } catch {
    return null;
  }
}

/**
 * Try to get currency by ticker, returns null instead of throwing
 */
export function tryGetCurrencyByTicker(ticker: string): ExternalCurrency | null {
  try {
    return getCurrencyByTicker(ticker);
  } catch {
    return null;
  }
}

/**
 * Get all currencies as an array
 */
export function getAllCurrencies(): ExternalCurrency[] {
  const application = useApplicationStore();
  return Object.values(application.currenciesData || {});
}

/**
 * Get currencies for a specific protocol
 */
export function getCurrenciesByProtocol(protocol: string): ExternalCurrency[] {
  const application = useApplicationStore();
  const currencies: ExternalCurrency[] = [];

  for (const key in application.currenciesData) {
    const [, p] = key.split("@");
    if (p === protocol) {
      currencies.push(application.currenciesData[key]);
    }
  }

  return currencies;
}


