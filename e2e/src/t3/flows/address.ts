import { createRequire } from "node:module";

interface EncodingLib {
  fromBech32(address: string): { prefix: string; data: Uint8Array };
  toBech32(prefix: string, data: Uint8Array): string;
}

// Playwright (pinned 1.61) installs a require-hook that cannot interop cosmjs's CJS build with its
// ESM-only deps, so a static `import` of `@cosmjs/encoding` aborts the browser run at collection —
// the same reason `signer.ts` loads cosmjs through `createRequire`. This module reuses that path so
// it is usable by both the Playwright specs and the vitest unit tests.
const loadModule = createRequire(import.meta.url);
const encodingLib = loadModule("@cosmjs/encoding") as EncodingLib;

const OSMOSIS_PREFIX = "osmo";

/** Re-encode a bech32 address under a different HRP, preserving its byte payload. */
export function reencodeAddress(address: string, prefix: string): string {
  const { data } = encodingLib.fromBech32(address);
  return encodingLib.toBech32(prefix, data);
}

/**
 * The Osmosis-side counterparty address for a Nolus account — the same key bytes under the `osmo`
 * HRP. Probing an Osmosis balance with the raw `nolus1…` string is rejected by the Osmosis chain
 * (wrong HRP); this yields the address the counterparty side actually holds.
 */
export function toOsmosisAddress(nolusAddress: string): string {
  return reencodeAddress(nolusAddress, OSMOSIS_PREFIX);
}
