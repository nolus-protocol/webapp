import { describe, expect, it } from "vitest";
import {
  DEFAULT_RATE_MAX_PERCENT,
  DEFAULT_USD_TOLERANCE,
  DEFAULT_WS_PUSH_TIMEOUT_MS,
  deriveWsUrl,
  isValidNolusAddress,
  parseConfig
} from "./config.js";

const VALID_ADDRESS = "nolus10hvz04hh92xzct5hxnpsn5h2fp3p4amm28vhvp";
const VALID_BASE = "https://app-dev.nolus.io";

describe("isValidNolusAddress", () => {
  it("accepts a real nolus account address", () => {
    expect(isValidNolusAddress(VALID_ADDRESS)).toBe(true);
  });

  it("rejects an address without the nolus1 prefix", () => {
    expect(isValidNolusAddress("osmo10hvz04hh92xzct5hxnpsn5h2fp3p4amm28vhvp")).toBe(false);
  });

  it("rejects an address containing a non-bech32 character", () => {
    expect(isValidNolusAddress("nolus1bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")).toBe(false);
  });

  it("rejects an address that is too short", () => {
    expect(isValidNolusAddress("nolus1abc")).toBe(false);
  });
});

describe("deriveWsUrl", () => {
  it("maps an https base to a wss /ws endpoint", () => {
    expect(deriveWsUrl("https://app-dev.nolus.io")).toBe("wss://app-dev.nolus.io/ws");
  });

  it("maps an http base to a ws /ws endpoint and preserves the port", () => {
    expect(deriveWsUrl("http://localhost:8080")).toBe("ws://localhost:8080/ws");
  });
});

describe("parseConfig", () => {
  it("reports both missing required variables together", () => {
    const result = parseConfig({});
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors.some((message) => message.startsWith("E2E_BASE_URL"))).toBe(true);
    expect(result.errors.some((message) => message.startsWith("E2E_READONLY_ADDRESS"))).toBe(true);
  });

  it("rejects an invalid readonly address", () => {
    const result = parseConfig({ E2E_BASE_URL: VALID_BASE, E2E_READONLY_ADDRESS: "not-an-address" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual([`E2E_READONLY_ADDRESS must be a nolus1 bech32 address (got "not-an-address")`]);
  });

  it("derives the ws url from the base url when none is provided", () => {
    const result = parseConfig({ E2E_BASE_URL: VALID_BASE, E2E_READONLY_ADDRESS: VALID_ADDRESS });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.config.wsUrl).toBe("wss://app-dev.nolus.io/ws");
  });

  it("applies documented defaults for optional variables", () => {
    const result = parseConfig({ E2E_BASE_URL: VALID_BASE, E2E_READONLY_ADDRESS: VALID_ADDRESS });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.config.usdTolerance).toBe(DEFAULT_USD_TOLERANCE);
    expect(result.config.wsPushTimeoutMs).toBe(DEFAULT_WS_PUSH_TIMEOUT_MS);
    expect(result.config.rateMaxPercent).toBe(DEFAULT_RATE_MAX_PERCENT);
  });

  it("rejects a negative usd tolerance", () => {
    const result = parseConfig({
      E2E_BASE_URL: VALID_BASE,
      E2E_READONLY_ADDRESS: VALID_ADDRESS,
      E2E_USD_TOLERANCE: "-1"
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual([`E2E_USD_TOLERANCE must be a non-negative number (got "-1")`]);
  });

  it("rejects a rate band whose minimum exceeds its maximum", () => {
    const result = parseConfig({
      E2E_BASE_URL: VALID_BASE,
      E2E_READONLY_ADDRESS: VALID_ADDRESS,
      E2E_RATE_MIN_PERCENT: "90",
      E2E_RATE_MAX_PERCENT: "10"
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual(["E2E_RATE_MIN_PERCENT (90) must not exceed E2E_RATE_MAX_PERCENT (10)"]);
  });
});
