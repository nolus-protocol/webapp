import { isNonNegativeDecimalString } from "./decimal.js";
import { parseHostResolver } from "./resolver.js";

export const DEFAULT_USD_TOLERANCE = "0.05";
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
const HTTP_SCHEMES = ["http:", "https:"];
const WS_SCHEMES = ["ws:", "wss:"];

export interface Config {
  baseUrl: string;
  wsUrl: string;
  readonlyAddress: string;
  hostOverrides: Map<string, string>;
  usdTolerance: string;
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

function parseUrl(value: string, schemes: string[]): URL | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  return schemes.includes(url.protocol) ? url : null;
}

interface NumberFieldSpec {
  raw: string;
  name: string;
  fallback: number;
  isValid: (value: number) => boolean;
  requirement: string;
}

function parseNumberField(spec: NumberFieldSpec, errors: string[]): number {
  const value = Number(spec.raw);
  if (!spec.isValid(value)) {
    errors.push(`${spec.name} must be ${spec.requirement} (got "${spec.raw}")`);
    return spec.fallback;
  }
  return value;
}

interface BaseUrlField {
  baseUrl: string;
  parsed: URL | null;
}

function parseBaseUrlField(env: Record<string, string | undefined>, errors: string[]): BaseUrlField {
  const raw = env.E2E_BASE_URL?.trim();
  if (!raw) {
    errors.push("E2E_BASE_URL is required (https origin of the SPA/API)");
    return { baseUrl: "", parsed: null };
  }
  const parsed = parseUrl(raw, HTTP_SCHEMES);
  if (!parsed) {
    errors.push(`E2E_BASE_URL must be a valid http(s) URL (got "${raw}")`);
    return { baseUrl: "", parsed: null };
  }
  return { baseUrl: raw, parsed };
}

function parseAddressField(env: Record<string, string | undefined>, errors: string[]): string {
  const raw = env.E2E_READONLY_ADDRESS?.trim();
  if (!raw) {
    errors.push("E2E_READONLY_ADDRESS is required (a nolus1 account address)");
    return "";
  }
  if (!isValidNolusAddress(raw)) {
    errors.push(`E2E_READONLY_ADDRESS must be a nolus1 bech32 address (got "${raw}")`);
    return "";
  }
  return raw;
}

function parseWsUrlField(env: Record<string, string | undefined>, errors: string[], base: BaseUrlField): string {
  const raw = env.E2E_WS_URL?.trim();
  if (raw) {
    if (!parseUrl(raw, WS_SCHEMES)) {
      errors.push(`E2E_WS_URL must be a valid ws(s) URL (got "${raw}")`);
      return "";
    }
    return raw;
  }
  return base.parsed ? deriveWsUrl(base.baseUrl) : "";
}

function parseToleranceField(env: Record<string, string | undefined>, errors: string[]): string {
  const raw = env.E2E_USD_TOLERANCE;
  if (raw === undefined) {
    return DEFAULT_USD_TOLERANCE;
  }
  if (!isNonNegativeDecimalString(raw)) {
    errors.push(`E2E_USD_TOLERANCE must be a non-negative decimal (got "${raw}")`);
    return DEFAULT_USD_TOLERANCE;
  }
  return raw.trim();
}

function parseWsPushTimeoutField(env: Record<string, string | undefined>, errors: string[]): number {
  const raw = env.E2E_WS_PUSH_TIMEOUT_MS;
  if (raw === undefined) {
    return DEFAULT_WS_PUSH_TIMEOUT_MS;
  }
  return parseNumberField(
    {
      raw,
      name: "E2E_WS_PUSH_TIMEOUT_MS",
      fallback: DEFAULT_WS_PUSH_TIMEOUT_MS,
      isValid: (value) => Number.isInteger(value) && value > 0,
      requirement: "a positive integer"
    },
    errors
  );
}

interface RateBandField {
  min: number;
  max: number;
}

function parseRatePercentField(raw: string | undefined, name: string, fallback: number, errors: string[]): number {
  if (raw === undefined) {
    return fallback;
  }
  return parseNumberField(
    { raw, name, fallback, isValid: (value) => Number.isFinite(value), requirement: "a finite number" },
    errors
  );
}

function parseRateBandField(env: Record<string, string | undefined>, errors: string[]): RateBandField {
  const min = parseRatePercentField(env.E2E_RATE_MIN_PERCENT, "E2E_RATE_MIN_PERCENT", DEFAULT_RATE_MIN_PERCENT, errors);
  const max = parseRatePercentField(env.E2E_RATE_MAX_PERCENT, "E2E_RATE_MAX_PERCENT", DEFAULT_RATE_MAX_PERCENT, errors);
  if (min > max) {
    errors.push(`E2E_RATE_MIN_PERCENT (${min}) must not exceed E2E_RATE_MAX_PERCENT (${max})`);
  }
  return { min, max };
}

export function parseConfig(env: Record<string, string | undefined>): ConfigResult {
  const errors: string[] = [];

  const base = parseBaseUrlField(env, errors);
  const readonlyAddress = parseAddressField(env, errors);
  const wsUrl = parseWsUrlField(env, errors, base);

  const resolver = parseHostResolver(env.E2E_HOST_RESOLVER);
  for (const message of resolver.errors) {
    errors.push(`E2E_HOST_RESOLVER: ${message}`);
  }

  const usdTolerance = parseToleranceField(env, errors);
  const wsPushTimeoutMs = parseWsPushTimeoutField(env, errors);
  const band = parseRateBandField(env, errors);
  const resultsDir = env.E2E_RESULTS_DIR?.trim() || DEFAULT_RESULTS_DIR;

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    config: {
      baseUrl: base.baseUrl,
      wsUrl,
      readonlyAddress,
      hostOverrides: resolver.overrides,
      usdTolerance,
      wsPushTimeoutMs,
      rateMinPercent: band.min,
      rateMaxPercent: band.max,
      resultsDir
    }
  };
}

export interface T1Config {
  baseUrl: string;
  hostOverrides: Map<string, string>;
}

export type T1ConfigResult = { ok: true; config: T1Config } | { ok: false; errors: string[] };

/**
 * The T1 (browser smoke) subset: only E2E_BASE_URL is required and the optional
 * E2E_HOST_RESOLVER pairs are reused. It shares the exact field parsers with the
 * full T0 config so the two never drift.
 */
export function parseT1Config(env: Record<string, string | undefined>): T1ConfigResult {
  const errors: string[] = [];

  const base = parseBaseUrlField(env, errors);
  const resolver = parseHostResolver(env.E2E_HOST_RESOLVER);
  for (const message of resolver.errors) {
    errors.push(`E2E_HOST_RESOLVER: ${message}`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, config: { baseUrl: base.baseUrl, hostOverrides: resolver.overrides } };
}
