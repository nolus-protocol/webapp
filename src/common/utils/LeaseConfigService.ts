/**
 * LeaseConfigService - Lease-specific configuration
 *
 * Handles fetching and caching of lease-related configuration:
 * - Downpayment ranges
 * - Lease position spec (min_asset, min_transaction)
 */

import { BackendApi } from "@/common/api";
import type { LeaseConfigResponse, DownpaymentRange, AmountSpec } from "@/common/api/types/webapp";

export type { DownpaymentRange };

// Cached promises per protocol
const leaseConfigCache: Record<string, Promise<LeaseConfigResponse>> = {};

/**
 * Get the full lease config for a protocol (cached)
 */
async function getLeaseConfig(protocol: string): Promise<LeaseConfigResponse> {
  if (!leaseConfigCache[protocol]) {
    leaseConfigCache[protocol] = BackendApi.getLeaseConfig(protocol);
  }
  return leaseConfigCache[protocol];
}

/**
 * Get downpayment ranges for a protocol
 */
export async function getDownpaymentRange(protocol: string): Promise<Record<string, DownpaymentRange>> {
  const config = await getLeaseConfig(protocol);
  return config.downpayment_ranges;
}

/**
 * Get lease position spec (min_asset, min_transaction) for a protocol
 */
export async function getLeasePositionSpec(
  protocol: string
): Promise<{ min_asset: AmountSpec; min_transaction: AmountSpec }> {
  const config = await getLeaseConfig(protocol);
  return { min_asset: config.min_asset, min_transaction: config.min_transaction };
}
