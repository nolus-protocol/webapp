/**
 * NetworkParser - Network and currency parsing utilities
 *
 * Handles parsing of network configuration and currency data from on-chain sources.
 */

import type { ExternalCurrency } from "@/common/types";
import { Oracle } from "@nolus/nolusjs/build/contracts";
import { NolusClient } from "@nolus/nolusjs";
import { useConfigStore } from "../stores/config";
import { getCurrencies, getHistoryCurrencies } from "./ConfigService";
import { NATIVE_NETWORK, NATIVE_ASSET, ProtocolsConfig, SORT_PROTOCOLS } from "@/config/global";

export interface ParsedNetworkData {
  assetIcons: Record<string, string>;
  networks: Record<string, Record<string, ExternalCurrency>>;
  map_keys: Record<string, string>;
}

/**
 * Parse network configuration and currency data from on-chain oracle contracts
 *
 * This function:
 * 1. Fetches currency metadata from the backend
 * 2. Queries each protocol's oracle contract for available currencies
 * 3. Builds a unified currency map with icons and metadata
 * 4. Includes historical currencies for display purposes
 */
export async function parseNetworks(): Promise<ParsedNetworkData> {
  const [cosmWasmClient, networks] = await Promise.all([
    NolusClient.getInstance().getCosmWasmClient(),
    getCurrencies(),
  ]);

  const configStore = useConfigStore();
  const tempNetwork: Record<string, ExternalCurrency> = {};
  const assetIcons: Record<string, string> = {};

  // Fetch currencies from each protocol's oracle
  const protocolPromises = Object.keys(configStore.contracts).map(async (protocolKey) => {
    const protocol = configStore.contracts[protocolKey];
    const oracleContract = new Oracle(cosmWasmClient, protocol.oracle);
    const currencies = await oracleContract.getCurrencies();

    const protocolCurrencies: string[] = [];

    for (const c of currencies) {
      const name = c.ticker.replace(/_/g, "")?.toLocaleLowerCase();
      const pr = protocolKey.split("-").at(0)?.toLocaleLowerCase();
      const key = `${c.ticker}@${protocolKey}`;

      protocolCurrencies.push(c.ticker);

      // Build icon URL
      assetIcons[key] = `${networks.icons}/${pr}-${name}.svg`;

      // Build currency entry
      tempNetwork[key] = {
        key,
        name: networks.currencies[c.ticker]?.name ?? c.ticker,
        shortName: networks.currencies[c.ticker]?.shortName ?? c.ticker,
        symbol: networks.currencies[c.ticker]?.symbol ?? c.ticker,
        decimal_digits: c.decimal_digits,
        ticker: c.ticker,
        native: c.bank_symbol === NATIVE_ASSET.denom,
        ibcData: c.bank_symbol,
        icon: assetIcons[key],
        coingeckoId: networks.currencies[c.ticker]?.coinGeckoId,
      };

      // Handle mapped keys (aliases)
      const mappedKey = networks.map[key];
      if (mappedKey) {
        tempNetwork[mappedKey] = { ...tempNetwork[key], key: mappedKey };
      }
    }

    // Update protocol currencies config
    ProtocolsConfig[protocolKey].currencies = protocolCurrencies;
  });

  // Wait for all protocol queries
  await Promise.all(protocolPromises);

  // Add historical currencies
  const history = await getHistoryCurrencies();

  for (const ticker in history) {
    const currencyData = history[ticker];
    for (const protocol in currencyData.protocols) {
      const key = `${ticker}@${protocol}`;
      tempNetwork[key] = {
        name: currencyData.name,
        symbol: currencyData.symbol,
        ticker: currencyData.ticker,
        decimal_digits: currencyData.decimal_digits,
        icon: currencyData.icon,
        shortName: currencyData.shortName,
        native: currencyData.native,
        coingeckoId: currencyData.coingeckoId,
        key,
        ibcData: currencyData.protocols[protocol].ibcData,
      } as ExternalCurrency;
    }
  }

  // Sort currencies by protocol order
  const sortedCurrencies = sortCurrenciesByProtocol(tempNetwork);

  return {
    assetIcons,
    networks: { [NATIVE_NETWORK.key]: sortedCurrencies },
    map_keys: networks.map,
  };
}

/**
 * Sort currencies by protocol priority defined in SORT_PROTOCOLS
 */
function sortCurrenciesByProtocol(
  currencies: Record<string, ExternalCurrency>
): Record<string, ExternalCurrency> {
  const allCurrencies = Object.values(currencies);
  const sortedCurrencies: ExternalCurrency[] = [];

  for (const protocol of SORT_PROTOCOLS) {
    const protocolCurrencies = allCurrencies
      .filter((item) => {
        const [, pr] = item.key.split("@");
        return pr === protocol;
      })
      .reverse();

    sortedCurrencies.push(...protocolCurrencies);
  }

  // Build result object maintaining sort order
  const result: Record<string, ExternalCurrency> = {};
  for (const currency of sortedCurrencies) {
    result[currency.key] = currency;
  }

  return result;
}


