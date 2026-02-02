/**
 * IbcUtils - IBC-related utilities
 *
 * Provides utilities for working with IBC (Inter-Blockchain Communication) data.
 */

import { sha256 } from "@cosmjs/crypto";

/**
 * Generate IBC denom hash from a transfer path
 *
 * @param path - The IBC transfer path (e.g., "transfer/channel-0/uatom")
 * @returns The IBC denom in format "ibc/HASH"
 *
 * @example
 * getIbcDenom("transfer/channel-0/uatom")
 * // Returns: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2"
 */
export function getIbcDenom(path: string): string {
  const hash = Buffer.from(sha256(Buffer.from(path)))
    .toString("hex")
    .toUpperCase();

  return `ibc/${hash}`;
}

/**
 * Check if a denom is an IBC denom
 */
export function isIbcDenom(denom: string): boolean {
  return denom.startsWith("ibc/");
}

/**
 * Extract the hash from an IBC denom
 * @returns The hash portion or null if not a valid IBC denom
 */
export function extractIbcHash(denom: string): string | null {
  if (!isIbcDenom(denom)) {
    return null;
  }
  return denom.slice(4); // Remove "ibc/" prefix
}

/**
 * Parse IBC path components
 */
export interface IbcPathComponents {
  port: string;
  channel: string;
  denom: string;
}

/**
 * Parse an IBC path into its components
 * @param path - Path like "transfer/channel-0/uatom"
 */
export function parseIbcPath(path: string): IbcPathComponents | null {
  const parts = path.split("/");

  if (parts.length < 3) {
    return null;
  }

  return {
    port: parts[0],
    channel: parts[1],
    denom: parts.slice(2).join("/"), // Handle nested paths
  };
}

/**
 * Build an IBC path from components
 */
export function buildIbcPath(port: string, channel: string, denom: string): string {
  return `${port}/${channel}/${denom}`;
}

// Alias used in history/common.ts
export const getIbc = getIbcDenom;
