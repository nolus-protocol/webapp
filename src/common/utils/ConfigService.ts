/**
 * ConfigService - Application configuration fetching
 *
 * Handles fetching and caching of application configuration:
 * - Skip route configuration
 * - Proposals configuration
 * - Network status
 */

import type { SkipRouteConfigType, ProposalsConfigType } from "@/common/types";
import { BackendApi } from "@/common/api";
import { CONTRACTS } from "@/config/global";
import { EnvNetworkUtils } from "./EnvNetworkUtils";

// Cached promises for configurations
let skipRouteConfigCache: Promise<SkipRouteConfigType> | null = null;
let proposalsConfigCache: Promise<ProposalsConfigType> | null = null;

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

// =============================================================================
// Private Implementation
// =============================================================================

async function fetchSkipRouteConfig(): Promise<SkipRouteConfigType> {
  const response = await BackendApi.getSwapConfig();
  return response as SkipRouteConfigType;
}

async function fetchProposalsConfig(): Promise<ProposalsConfigType> {
  const response = await BackendApi.getHiddenProposals();
  return {
    hide: response.hidden_ids,
  };
}
