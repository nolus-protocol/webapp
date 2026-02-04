/**
 * LeaseConfigService - Lease-specific configuration
 *
 * Handles fetching and caching of lease-related configuration:
 * - Downpayment ranges
 * - Free interest addresses
 * - Due projection settings
 *
 * Note: Asset ignore lists (ignore_long, ignore_short, ignore_all) are now
 * handled by the backend in /api/protocols/{protocol}/currencies endpoint.
 * Free interest assets are handled by a 3rd party service.
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
let freeInterestAddressCache: Promise<FreeInterestAddresses> | null = null;
let dueProjectionCache: Promise<DueProjection> | null = null;

/**
 * Get downpayment range for a protocol
 */
export async function getDownpaymentRange(protocol: string): Promise<Record<string, DownpaymentRange>> {
  if (!downpaymentRangeCache[protocol]) {
    downpaymentRangeCache[protocol] = fetchDownpaymentRange(protocol);
  }
  return downpaymentRangeCache[protocol];
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
 * Clear all lease config caches
 */
export function clearLeaseConfigCaches(): void {
  Object.keys(downpaymentRangeCache).forEach((key) => delete downpaymentRangeCache[key]);
  freeInterestAddressCache = null;
  dueProjectionCache = null;
}

// =============================================================================
// Private Implementation
// =============================================================================

async function fetchDownpaymentRange(protocol: string): Promise<Record<string, DownpaymentRange>> {
  const response = await BackendApi.getWebappDownpaymentRangeForProtocol(protocol);
  return { [protocol]: response };
}

async function fetchFreeInterestAddress(): Promise<FreeInterestAddresses> {
  return BackendApi.getWebappZeroInterestAddresses();
}

async function fetchDueProjectionSecs(): Promise<DueProjection> {
  const response = await BackendApi.getWebappDueProjection();
  return { due_projection_secs: response.seconds };
}
