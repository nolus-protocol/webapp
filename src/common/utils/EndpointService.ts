/**
 * EndpointService - RPC/API endpoint management with health checking
 *
 * Fetches network endpoints from /api/networks/gated and provides
 * health-checked RPC/LCD endpoints with fallback support.
 */

import type { API } from "@/common/types";
import type { GatedNetworkInfo } from "@/common/api";
import { BackendApi } from "@/common/api";

// Cache for gated networks response
let networksCache: GatedNetworkInfo[] | null = null;

// Cache for resolved endpoints by network key
const endpointCache: Record<string, Promise<API>> = {};

/**
 * Fetch Cosmos RPC/LCD endpoints for a network with health checking and fallback
 */
export async function fetchEndpoints(network: string): Promise<API> {
  // Check cache
  if (endpointCache[network]) {
    return endpointCache[network];
  }

  // Fetch and cache
  const endpointPromise = fetchCosmosEndpoint(network);
  endpointCache[network] = endpointPromise;

  return endpointPromise;
}

/**
 * Clear endpoint cache
 */
export function clearEndpointCaches(): void {
  networksCache = null;
  Object.keys(endpointCache).forEach((key) => delete endpointCache[key]);
}

// =============================================================================
// Private Implementation
// =============================================================================

/**
 * Get all gated networks (cached)
 */
async function getNetworks(): Promise<GatedNetworkInfo[]> {
  if (networksCache) {
    return networksCache;
  }

  const response = await BackendApi.getGatedNetworks();
  networksCache = response.networks;
  return networksCache;
}

/**
 * Find network info by key
 */
async function findNetwork(network: string): Promise<GatedNetworkInfo> {
  const networks = await getNetworks();
  const networkInfo = networks.find((n) => n.network === network);

  if (!networkInfo) {
    throw new Error(`Network not found: ${network}`);
  }

  return networkInfo;
}

/**
 * Fetch Cosmos endpoint (returns primary endpoint directly)
 * Health checking is disabled for now to simplify debugging
 */
async function fetchCosmosEndpoint(network: string): Promise<API> {
  const networkInfo = await findNetwork(network);

  // Return primary endpoint directly
  return {
    rpc: networkInfo.rpc,
    api: networkInfo.lcd
  };
}

/**
 * Fetch EVM RPC endpoints for a network
 * TODO: EVM networks need to be added to the gated system or handled separately
 */
export async function fetchEvmEndpoints(network: string): Promise<API> {
  throw new Error(`EVM network endpoints not yet supported in gated system: ${network}`);
}
