import { parseHostResolver } from "./resolver.js";

export const DEFAULT_USD_TOLERANCE = 0.05;
export const DEFAULT_WS_PUSH_TIMEOUT_MS = 60000;
export const DEFAULT_RATE_MIN_PERCENT = 0;
export const DEFAULT_RATE_MAX_PERCENT = 100;
export const DEFAULT_RESULTS_DIR = "./results";

export const WS_ACK_TIMEOUT_MS = 10000;
export const RESULTS_FILE_NAME = "t0.json";

const NOLUS_PREFIX = "nolus1";
const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const MIN_ADDRESS_LENGTH = 44;
const MAX_ADDRESS_LENGTH = 66;

export interface Config {
  baseUrl: string;
  wsUrl: string;
  readonlyAddress: string;
  hostOverrides: Map<string, string>;
  usdTolerance: number;
  wsPushTimeoutMs: number;
  rateMinPercent: number;
  rateMaxPercent: number;
  resultsDir: string;
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; errors: string[] };

export function isValidNolusAddress(address: string): boolean {
  if (!address.startsWith(NOLUS_PREFIX)) {
    return false;
  }
  if (address.length < MIN_ADDRESS_LENGTH || address.length > MAX_ADDRESS_LENGTH) {
    return false;
  }
  const data = address.slice(NOLUS_PREFIX.length);
  for (const char of data) {
    if (!BECH32_CHARSET.includes(char)) {
      return false;
    }
  }
  return true;
}

export function deriveWsUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const scheme = url.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${url.host}/ws`;
}

function parseHttpUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  return url;
}

function parseWsUrl(value: string): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    return null;
  }
  return url;
}

function parseNonNegativeNumber(raw: string, name: string, errors: string[], fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    errors.push(`${name} must be a non-negative number (got "${raw}")`);
    return fallback;
  }
  return value;
}

function parseFiniteNumber(raw: string, name: string, errors: string[], fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    errors.push(`${name} must be a finite number (got "${raw}")`);
    return fallback;
  }
  return value;
}

function parsePositiveInteger(raw: string, name: string, errors: string[], fallback: number): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${name} must be a positive integer (got "${raw}")`);
    return fallback;
  }
  return value;
}

export function parseConfig(env: Record<string, string | undefined>): ConfigResult {
  const errors: string[] = [];

  const rawBaseUrl = env.E2E_BASE_URL?.trim();
  let baseUrl = "";
  let baseUrlParsed: URL | null = null;
  if (!rawBaseUrl) {
    errors.push("E2E_BASE_URL is required (https origin of the SPA/API)");
  } else {
    baseUrlParsed = parseHttpUrl(rawBaseUrl);
    if (!baseUrlParsed) {
      errors.push(`E2E_BASE_URL must be a valid http(s) URL (got "${rawBaseUrl}")`);
    } else {
      baseUrl = rawBaseUrl;
    }
  }

  const rawAddress = env.E2E_READONLY_ADDRESS?.trim();
  let readonlyAddress = "";
  if (!rawAddress) {
    errors.push("E2E_READONLY_ADDRESS is required (a nolus1 account address)");
  } else if (!isValidNolusAddress(rawAddress)) {
    errors.push(`E2E_READONLY_ADDRESS must be a nolus1 bech32 address (got "${rawAddress}")`);
  } else {
    readonlyAddress = rawAddress;
  }

  let wsUrl = "";
  const rawWsUrl = env.E2E_WS_URL?.trim();
  if (rawWsUrl) {
    if (!parseWsUrl(rawWsUrl)) {
      errors.push(`E2E_WS_URL must be a valid ws(s) URL (got "${rawWsUrl}")`);
    } else {
      wsUrl = rawWsUrl;
    }
  } else if (baseUrlParsed) {
    wsUrl = deriveWsUrl(baseUrl);
  }

  const resolver = parseHostResolver(env.E2E_HOST_RESOLVER);
  for (const message of resolver.errors) {
    errors.push(`E2E_HOST_RESOLVER: ${message}`);
  }

  const usdTolerance =
    env.E2E_USD_TOLERANCE === undefined
      ? DEFAULT_USD_TOLERANCE
      : parseNonNegativeNumber(env.E2E_USD_TOLERANCE, "E2E_USD_TOLERANCE", errors, DEFAULT_USD_TOLERANCE);

  const wsPushTimeoutMs =
    env.E2E_WS_PUSH_TIMEOUT_MS === undefined
      ? DEFAULT_WS_PUSH_TIMEOUT_MS
      : parsePositiveInteger(env.E2E_WS_PUSH_TIMEOUT_MS, "E2E_WS_PUSH_TIMEOUT_MS", errors, DEFAULT_WS_PUSH_TIMEOUT_MS);

  const rateMinPercent =
    env.E2E_RATE_MIN_PERCENT === undefined
      ? DEFAULT_RATE_MIN_PERCENT
      : parseFiniteNumber(env.E2E_RATE_MIN_PERCENT, "E2E_RATE_MIN_PERCENT", errors, DEFAULT_RATE_MIN_PERCENT);

  const rateMaxPercent =
    env.E2E_RATE_MAX_PERCENT === undefined
      ? DEFAULT_RATE_MAX_PERCENT
      : parseFiniteNumber(env.E2E_RATE_MAX_PERCENT, "E2E_RATE_MAX_PERCENT", errors, DEFAULT_RATE_MAX_PERCENT);

  if (rateMinPercent > rateMaxPercent) {
    errors.push(`E2E_RATE_MIN_PERCENT (${rateMinPercent}) must not exceed E2E_RATE_MAX_PERCENT (${rateMaxPercent})`);
  }

  const resultsDir = env.E2E_RESULTS_DIR?.trim() || DEFAULT_RESULTS_DIR;

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    config: {
      baseUrl,
      wsUrl,
      readonlyAddress,
      hostOverrides: resolver.overrides,
      usdTolerance,
      wsPushTimeoutMs,
      rateMinPercent,
      rateMaxPercent,
      resultsDir
    }
  };
}
