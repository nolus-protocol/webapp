/**
 * ConfigService - Application configuration fetching
 *
 * Handles fetching and caching of application configuration:
 * - Skip route configuration
 * - Proposals configuration
 * - Network status
 */

import type { SkipRouteConfigType, ProposalsConfigType } from "@/common/types";
import type { ZodType } from "zod";
import { BackendApi } from "@/common/api";
import { SkipRouteConfigSchema } from "@/common/api/schemas";
import { CONTRACTS } from "@/config/global";
import { NetworkEnv } from "./NetworkEnv";

// Cached promises for configurations
let skipRouteConfigCache: Promise<SkipRouteConfigType> | null = null;
let proposalsConfigCache: Promise<ProposalsConfigType> | null = null;

/**
 * Get Skip Route configuration for cross-chain swaps
 */
export async function getSkipRouteConfig(): Promise<SkipRouteConfigType> {
  if (!skipRouteConfigCache) {
    const promise = fetchSkipRouteConfig();
    promise.catch(() => {
      skipRouteConfigCache = null;
    });
    skipRouteConfigCache = promise;
  }
  return skipRouteConfigCache;
}

/**
 * Get proposals configuration (hidden proposals, etc.)
 */
export async function getProposalsConfig(): Promise<ProposalsConfigType> {
  if (!proposalsConfigCache) {
    const promise = fetchProposalsConfig();
    promise.catch(() => {
      proposalsConfigCache = null;
    });
    proposalsConfigCache = promise;
  }
  return proposalsConfigCache;
}

/**
 * Get available protocols for the current network
 */
export function getProtocols(): Record<string, string> {
  return CONTRACTS[NetworkEnv.getStoredNetworkName()].protocols;
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
        network: status.network
      }
    }
  };
}

// =============================================================================
// Private Implementation
// =============================================================================

async function fetchSkipRouteConfig(): Promise<SkipRouteConfigType> {
  const response = await BackendApi.getSwapConfig();
  // The schema mirrors SkipRouteConfigType, matching how BackendApi bridges its
  // other endpoints (`Schema as ZodType<T>`); the parse is the real validation.
  const result = (SkipRouteConfigSchema as ZodType<SkipRouteConfigType>).safeParse(response);
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    console.error(`[ConfigService] Invalid swap config response (invalid: ${fields})`);
    throw new Error("Invalid swap config response");
  }
  return result.data;
}

async function fetchProposalsConfig(): Promise<ProposalsConfigType> {
  const response = await BackendApi.getHiddenProposals();
  return {
    hide: response.hidden_ids
  };
}
