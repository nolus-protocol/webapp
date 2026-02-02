/**
 * LeaseConfigService - Lease-specific configuration
 *
 * Handles fetching and caching of lease-related configuration:
 * - Downpayment ranges
 * - Free interest assets and addresses
 * - Due projection settings
 * - Ignore asset lists
 */

import { BackendApi } from "@/common/api";

// Types
export interface DownpaymentRange {
  min: number;
  max: number;
}

export interface FreeInterestAddresses {
  interest_paid_to: string[];
}

export interface DueProjection {
  due_projection_secs: number;
}

// Cached promises
const downpaymentRangeCache: Record<string, Promise<Record<string, DownpaymentRange>>> = {};
let freeInterestCache: Promise<string[]> | null = null;
let freeInterestAddressCache: Promise<FreeInterestAddresses> | null = null;
let dueProjectionCache: Promise<DueProjection> | null = null;
let ignoreLeaseLongCache: Promise<string[]> | null = null;
let ignoreLeaseShortCache: Promise<string[]> | null = null;
let ignoreAssetsCache: Promise<string[]> | null = null;

/**
 * Get downpayment range for a protocol
 */
export async function getDownpaymentRange(
  protocol: string
): Promise<Record<string, DownpaymentRange>> {
  if (!downpaymentRangeCache[protocol]) {
    downpaymentRangeCache[protocol] = fetchDownpaymentRange(protocol);
  }
  return downpaymentRangeCache[protocol];
}

/**
 * Get free interest assets
 */
export async function getFreeInterest(): Promise<string[]> {
  if (!freeInterestCache) {
    freeInterestCache = fetchFreeInterest();
  }
  return freeInterestCache;
}

/**
 * Get free interest payment addresses
 */
export async function getFreeInterestAddress(): Promise<FreeInterestAddresses> {
  if (!freeInterestAddressCache) {
    freeInterestAddressCache = fetchFreeInterestAddress();
  }
  return freeInterestAddressCache;
}

/**
 * Get due projection seconds
 */
export async function getDueProjectionSecs(): Promise<DueProjection> {
  if (!dueProjectionCache) {
    dueProjectionCache = fetchDueProjectionSecs();
  }
  return dueProjectionCache;
}

/**
 * Get assets to ignore for long leases
 */
export async function getIgnoreLeaseLongAssets(): Promise<string[]> {
  if (!ignoreLeaseLongCache) {
    ignoreLeaseLongCache = fetchIgnoreLeaseLongAssets();
  }
  return ignoreLeaseLongCache;
}

/**
 * Get assets to ignore for short leases
 */
export async function getIgnoreLeaseShortAssets(): Promise<string[]> {
  if (!ignoreLeaseShortCache) {
    ignoreLeaseShortCache = fetchIgnoreLeaseShortAssets();
  }
  return ignoreLeaseShortCache;
}

/**
 * Get general ignored assets
 */
export async function getIgnoreAssets(): Promise<string[]> {
  if (!ignoreAssetsCache) {
    ignoreAssetsCache = fetchIgnoreAssets();
  }
  return ignoreAssetsCache;
}

/**
 * Clear all lease config caches
 */
export function clearLeaseConfigCaches(): void {
  Object.keys(downpaymentRangeCache).forEach((key) => delete downpaymentRangeCache[key]);
  freeInterestCache = null;
  freeInterestAddressCache = null;
  dueProjectionCache = null;
  ignoreLeaseLongCache = null;
  ignoreLeaseShortCache = null;
  ignoreAssetsCache = null;
}

// =============================================================================
// Private Implementation
// =============================================================================

async function fetchDownpaymentRange(
  protocol: string
): Promise<Record<string, DownpaymentRange>> {
  const response = await BackendApi.getWebappDownpaymentRangeForProtocol(protocol);
  return { [protocol]: response };
}

async function fetchFreeInterest(): Promise<string[]> {
  return BackendApi.getWebappFreeInterestAssets();
}

async function fetchFreeInterestAddress(): Promise<FreeInterestAddresses> {
  return BackendApi.getWebappZeroInterestAddresses();
}

async function fetchDueProjectionSecs(): Promise<DueProjection> {
  const response = await BackendApi.getWebappDueProjection();
  return { due_projection_secs: response.seconds };
}

async function fetchIgnoreLeaseLongAssets(): Promise<string[]> {
  return BackendApi.getWebappIgnoreLeaseLong();
}

async function fetchIgnoreLeaseShortAssets(): Promise<string[]> {
  return BackendApi.getWebappIgnoreLeaseShort();
}

async function fetchIgnoreAssets(): Promise<string[]> {
  return BackendApi.getWebappIgnoreAssets();
}


