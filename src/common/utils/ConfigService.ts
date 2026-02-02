/**
 * ConfigService - Application configuration fetching
 *
 * Handles fetching and caching of application configuration:
 * - Currencies and chain IDs
 * - Skip route configuration
 * - Proposals configuration
 * - History currencies and protocols
 * - Network status
 */

import type { HistoryCurrency, HistoryProtocols } from "../types/Currecies";
import type { CurrenciesConfig } from "../types/Networks";
import type { SkipRouteConfigType, ProposalsConfigType } from "@/common/types";
import { BackendApi } from "@/common/api";
import { CONTRACTS } from "@/config/global";
import { EnvNetworkUtils } from "./EnvNetworkUtils";

// Cached promises for configurations
let currenciesCache: Promise<CurrenciesConfig> | null = null;
let chainIdsCache: Promise<Record<string, Record<string, string>>> | null = null;
let skipRouteConfigCache: Promise<SkipRouteConfigType> | null = null;
let proposalsConfigCache: Promise<ProposalsConfigType> | null = null;
let historyCurrenciesCache: Promise<Record<string, HistoryCurrency>> | null = null;
let historyProtocolsCache: Promise<Record<string, HistoryProtocols>> | null = null;

/**
 * Get currencies configuration
 */
export async function getCurrencies(): Promise<CurrenciesConfig> {
  if (!currenciesCache) {
    currenciesCache = fetchCurrencies();
  }
  return currenciesCache;
}

/**
 * Get chain IDs for cosmos and evm networks
 */
export async function getChainIds(): Promise<Record<string, Record<string, string>>> {
  if (!chainIdsCache) {
    chainIdsCache = fetchChainIds();
  }
  return chainIdsCache;
}

/**
 * Get Skip Route configuration for cross-chain swaps
 */
export async function getSkipRouteConfig(): Promise<SkipRouteConfigType> {
  if (!skipRouteConfigCache) {
    skipRouteConfigCache = fetchSkipRouteConfig();
  }
  return skipRouteConfigCache;
}

/**
 * Get proposals configuration (hidden proposals, etc.)
 */
export async function getProposalsConfig(): Promise<ProposalsConfigType> {
  if (!proposalsConfigCache) {
    proposalsConfigCache = fetchProposalsConfig();
  }
  return proposalsConfigCache;
}

/**
 * Get history currencies for historical data display
 */
export async function getHistoryCurrencies(): Promise<Record<string, HistoryCurrency>> {
  if (!historyCurrenciesCache) {
    historyCurrenciesCache = fetchHistoryCurrencies();
  }
  return historyCurrenciesCache;
}

/**
 * Get history protocols for historical data display
 */
export async function getHistoryProtocols(): Promise<Record<string, HistoryProtocols>> {
  if (!historyProtocolsCache) {
    historyProtocolsCache = fetchHistoryProtocols();
  }
  return historyProtocolsCache;
}

/**
 * Get available protocols for the current network
 */
export function getProtocols(): Record<string, string> {
  return CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].protocols;
}

/**
 * Get the default protocol for the current network
 */
export function getDefaultProtocol(): string {
  const protocols = getProtocols();
  const networkName = EnvNetworkUtils.getStoredNetworkName();

  switch (networkName) {
    case "mainnet":
      return protocols.osmosis_noble;
    case "testnet":
      return protocols.osmosis;
    default:
      return protocols.osmosis_noble;
  }
}

/**
 * Fetch network status from backend
 */
export async function fetchNetworkStatus(): Promise<{
  result: { node_info: { network: string } };
}> {
  const status = await BackendApi.getNetworkStatus();

  return {
    result: {
      node_info: {
        network: status.network,
      },
    },
  };
}

/**
 * Clear all configuration caches
 */
export function clearConfigCaches(): void {
  currenciesCache = null;
  chainIdsCache = null;
  skipRouteConfigCache = null;
  proposalsConfigCache = null;
  historyCurrenciesCache = null;
  historyProtocolsCache = null;
}

// =============================================================================
// Private Implementation
// =============================================================================

async function fetchCurrencies(): Promise<CurrenciesConfig> {
  const response = await BackendApi.getWebappCurrencies();
  return response as unknown as CurrenciesConfig;
}

async function fetchChainIds(): Promise<Record<string, Record<string, string>>> {
  const response = await BackendApi.getWebappChainIds();
  return {
    cosmos: response.cosmos,
    evm: response.evm,
  };
}

async function fetchSkipRouteConfig(): Promise<SkipRouteConfigType> {
  const response = await BackendApi.getWebappSkipRouteConfig();
  return response as SkipRouteConfigType;
}

async function fetchProposalsConfig(): Promise<ProposalsConfigType> {
  const response = await BackendApi.getWebappHiddenProposals();
  return {
    hidden_ids: response.hidden_ids,
  } as ProposalsConfigType;
}

async function fetchHistoryCurrencies(): Promise<Record<string, HistoryCurrency>> {
  const response = await BackendApi.getWebappHistoryCurrencies();
  return response.currencies as unknown as Record<string, HistoryCurrency>;
}

async function fetchHistoryProtocols(): Promise<Record<string, HistoryProtocols>> {
  const response = await BackendApi.getWebappHistoryProtocols();
  return response.protocols as unknown as Record<string, HistoryProtocols>;
}


