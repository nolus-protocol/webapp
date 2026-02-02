/**
 * EndpointService - RPC/API endpoint management with fallback logic
 *
 * Handles fetching and caching of network endpoints, including:
 * - Cosmos RPC endpoints with health checking
 * - EVM RPC endpoints
 * - Archive node endpoints
 */

import type { API, ARCHIVE_NODE, Endpoint, Node } from "@/common/types";
import { connectComet } from "@cosmjs/tendermint-rpc";
import { EnvNetworkUtils } from "./EnvNetworkUtils";
import { NETWORK } from "@/config/global";
import { BackendApi } from "@/common/api";

// Cache for RPC endpoints by network
const rpcCache: Record<string, Record<string, Promise<API>>> = {};

// Cache for EVM endpoints
const evmRpcCache: Record<string, Promise<API>> = {};

// Cache for archive nodes
const archiveNodeCache: Record<string, Promise<ARCHIVE_NODE>> = {};

/**
 * Fetch Cosmos RPC endpoints for a network with health checking and fallback
 */
export async function fetchEndpoints(network: string): Promise<API> {
  const networkName = EnvNetworkUtils.getStoredNetworkName();

  // Check cache
  if (rpcCache[networkName]?.[network]) {
    return rpcCache[networkName][network];
  }

  // Initialize cache for this network
  if (!rpcCache[networkName]) {
    rpcCache[networkName] = {};
  }

  // Fetch and cache
  const endpointPromise = fetchCosmosEndpoint(network);
  rpcCache[networkName][network] = endpointPromise;

  return endpointPromise;
}

/**
 * Fetch EVM RPC endpoints for a network
 */
export async function fetchEvmEndpoints(network: string): Promise<API> {
  // Check cache
  if (evmRpcCache[network]) {
    return evmRpcCache[network];
  }

  // Fetch and cache
  const endpointPromise = fetchEvmEndpoint(network);
  evmRpcCache[network] = endpointPromise;

  return endpointPromise;
}

/**
 * Get archive node endpoints
 */
export async function getArchiveNodes(): Promise<ARCHIVE_NODE> {
  const networkName = EnvNetworkUtils.getStoredNetworkName();

  // Check cache
  if (archiveNodeCache[networkName]) {
    return archiveNodeCache[networkName];
  }

  // Fetch and cache
  const archivePromise = fetchArchiveNodes();
  archiveNodeCache[networkName] = archivePromise;

  return archivePromise;
}

/**
 * Clear all endpoint caches
 */
export function clearEndpointCaches(): void {
  Object.keys(rpcCache).forEach((key) => delete rpcCache[key]);
  Object.keys(evmRpcCache).forEach((key) => delete evmRpcCache[key]);
  Object.keys(archiveNodeCache).forEach((key) => delete archiveNodeCache[key]);
}

// =============================================================================
// Private Implementation
// =============================================================================

async function fetchCosmosEndpoint(network: string): Promise<API> {
  const config = NETWORK;
  const networkKey = config.endpoints as string;
  const json = (await BackendApi.getWebappNetworkEndpoints(networkKey)) as unknown as Endpoint;

  const node = json[network] as Node;
  const isHealthy = await checkCosmosHealth(node.primary.rpc, json.downtime);

  if (isHealthy) {
    return node.primary;
  }

  return findHealthyFallback(node, json.downtime);
}

async function fetchEvmEndpoint(network: string): Promise<API> {
  const config = NETWORK;
  const networkKey = config.evmEndpoints as string;
  const json = (await BackendApi.getWebappNetworkEndpoints(networkKey)) as unknown as Endpoint;

  const node = json[network] as Node;
  const isHealthy = await checkEvmHealth(node.primary.rpc);

  if (isHealthy) {
    return node.primary;
  }

  return findHealthyEvmFallback(node);
}

async function fetchArchiveNodes(): Promise<ARCHIVE_NODE> {
  const config = NETWORK;
  const networkKey = config.endpoints as string;
  const json = await BackendApi.getWebappNetworkEndpoints(networkKey);

  return {
    archive_node_rpc: (json as unknown as Endpoint).archive_node_rpc,
    archive_node_api: (json as unknown as Endpoint).archive_node_api,
  };
}

async function findHealthyFallback(node: Node, downtime: number): Promise<API> {
  const fallbacks = [...node.fallback]; // Clone to avoid mutation

  for (const fallback of fallbacks) {
    const isHealthy = await checkCosmosHealth(fallback.rpc, downtime);
    if (isHealthy) {
      return fallback;
    }
  }

  // If no healthy fallback found, return primary anyway
  return node.primary;
}

async function findHealthyEvmFallback(node: Node): Promise<API> {
  const fallbacks = [...node.fallback]; // Clone to avoid mutation

  for (const fallback of fallbacks) {
    const isHealthy = await checkEvmHealth(fallback.rpc);
    if (isHealthy) {
      return fallback;
    }
  }

  // If no healthy fallback found, return primary anyway
  return node.primary;
}

async function checkCosmosHealth(rpc: string, downtimeSeconds: number): Promise<boolean> {
  try {
    const client = await connectComet(rpc);
    const status = await client.status();
    const lastBlockTime = status.syncInfo.latestBlockTime;
    const now = Date.now();
    const maxDowntimeMs = downtimeSeconds * 1000;

    const isHealthy = now - lastBlockTime.getTime() <= maxDowntimeMs;

    client.disconnect();
    return isHealthy;
  } catch {
    return false;
  }
}

async function checkEvmHealth(rpc: string): Promise<boolean> {
  try {
    const response = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "eth_syncing",
        params: [],
        id: 1,
        jsonrpc: "2.0",
      }),
    });
    const json = await response.json();
    // If result is false, the node is synced (healthy)
    return !json.result;
  } catch {
    return false;
  }
}


