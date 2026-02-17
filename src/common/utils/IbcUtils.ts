/**
 * IbcUtils - IBC-related utilities
 */

import { sha256 } from "@cosmjs/crypto";

/**
 * Generate IBC denom hash from a transfer path
 *
 * @param path - The IBC transfer path (e.g., "transfer/channel-0/uatom")
 * @returns The IBC denom in format "ibc/HASH"
 */
export function getIbcDenom(path: string): string {
  const hash = Buffer.from(sha256(Buffer.from(path)))
    .toString("hex")
    .toUpperCase();

  return `ibc/${hash}`;
}

// Alias used in history/common.ts
export const getIbc = getIbcDenom;
