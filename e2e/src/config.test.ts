import { describe, expect, it } from "vitest";
import {
  DEFAULT_RATE_MAX_PERCENT,
  DEFAULT_USD_TOLERANCE,
  DEFAULT_WS_PUSH_TIMEOUT_MS,
  deriveWsUrl,
  isValidNolusAddress,
  parseConfig,
  parseT1Config,
  parseT2Config,
  PUBLIC_FALLBACK_MNEMONIC
} from "./config.js";

// The canonical public all-zeros BIP-39 vector, used only to exercise the parser's
// happy path — never a realistic secret.
const VALID_MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const VALID_ADDRESS = "nolus10hvz04hh92xzct5hxnpsn5h2fp3p4amm28vhvp";
const VALID_BASE = "https://app-dev.nolus.io";

function required(extra: Record<string, string | undefined>): Record<string, string | undefined> {
  return { E2E_BASE_URL: VALID_BASE, E2E_READONLY_ADDRESS: VALID_ADDRESS, ...extra };
}

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

  it("rejects a malformed base url", () => {
    const result = parseConfig({ E2E_BASE_URL: "not a url", E2E_READONLY_ADDRESS: VALID_ADDRESS });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual([`E2E_BASE_URL must be a valid http(s) URL (got "not a url")`]);
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
    const result = parseConfig(required({}));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.config.wsUrl).toBe("wss://app-dev.nolus.io/ws");
  });

  it("accepts an explicit ws url override", () => {
    const result = parseConfig(required({ E2E_WS_URL: "wss://ws.example.test/ws" }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.config.wsUrl).toBe("wss://ws.example.test/ws");
  });

  it("rejects a ws url with a non-ws scheme", () => {
    const result = parseConfig(required({ E2E_WS_URL: "https://ws.example.test" }));
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual([`E2E_WS_URL must be a valid ws(s) URL (got "https://ws.example.test")`]);
  });

  it("applies documented defaults for optional variables", () => {
    const result = parseConfig(required({}));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.config.usdTolerance).toBe(DEFAULT_USD_TOLERANCE);
    expect(result.config.wsPushTimeoutMs).toBe(DEFAULT_WS_PUSH_TIMEOUT_MS);
    expect(result.config.rateMaxPercent).toBe(DEFAULT_RATE_MAX_PERCENT);
  });

  it("keeps the usd tolerance as a validated decimal string", () => {
    const result = parseConfig(required({ E2E_USD_TOLERANCE: "0.10" }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.config.usdTolerance).toBe("0.10");
  });

  it("rejects a negative usd tolerance", () => {
    const result = parseConfig(required({ E2E_USD_TOLERANCE: "-1" }));
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual([`E2E_USD_TOLERANCE must be a non-negative decimal (got "-1")`]);
  });

  it("rejects a non-positive-integer push timeout", () => {
    const result = parseConfig(required({ E2E_WS_PUSH_TIMEOUT_MS: "0" }));
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual([`E2E_WS_PUSH_TIMEOUT_MS must be a positive integer (got "0")`]);
  });

  it("prefixes a malformed host-resolver pair without echoing its content", () => {
    const result = parseConfig(required({ E2E_HOST_RESOLVER: "nodelimiter" }));
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual([`E2E_HOST_RESOLVER: pair 1 is missing "=" (expected host=target)`]);
  });

  it("rejects a rate band whose minimum exceeds its maximum", () => {
    const result = parseConfig(required({ E2E_RATE_MIN_PERCENT: "90", E2E_RATE_MAX_PERCENT: "10" }));
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual(["E2E_RATE_MIN_PERCENT (90) must not exceed E2E_RATE_MAX_PERCENT (10)"]);
  });
});

describe("parseT1Config", () => {
  it("accepts only E2E_BASE_URL and does not require an address", () => {
    const result = parseT1Config({ E2E_BASE_URL: VALID_BASE });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.config.baseUrl).toBe(VALID_BASE);
    expect(result.config.hostOverrides.size).toBe(0);
  });

  it("reuses the host-resolver pairs", () => {
    const result = parseT1Config({ E2E_BASE_URL: VALID_BASE, E2E_HOST_RESOLVER: "app-dev.nolus.io=198.51.100.7" });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.config.hostOverrides.get("app-dev.nolus.io")).toBe("198.51.100.7");
  });

  it("fails hard with a descriptive error when E2E_BASE_URL is missing", () => {
    const result = parseT1Config({});
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual(["E2E_BASE_URL is required (https origin of the SPA/API)"]);
  });

  it("prefixes a malformed host-resolver pair", () => {
    const result = parseT1Config({ E2E_BASE_URL: VALID_BASE, E2E_HOST_RESOLVER: "nodelimiter" });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual([`E2E_HOST_RESOLVER: pair 1 is missing "=" (expected host=target)`]);
  });
});

describe("parseT2Config", () => {
  it("accepts a primary mnemonic and falls back to the public vector for the secondary", () => {
    const result = parseT2Config({ E2E_WALLET_MNEMONIC: VALID_MNEMONIC });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.config.primaryMnemonic).toBe(VALID_MNEMONIC);
    expect(result.config.secondaryMnemonic).toBe(PUBLIC_FALLBACK_MNEMONIC);
  });

  it("uses an explicit secondary mnemonic when provided", () => {
    const result = parseT2Config({
      E2E_WALLET_MNEMONIC: VALID_MNEMONIC,
      E2E_WALLET_MNEMONIC_2: PUBLIC_FALLBACK_MNEMONIC
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success");
    }
    expect(result.config.secondaryMnemonic).toBe(PUBLIC_FALLBACK_MNEMONIC);
  });

  it("requires E2E_WALLET_MNEMONIC and names only the variable", () => {
    const result = parseT2Config({});
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual([
      "E2E_WALLET_MNEMONIC is required (a BIP-39 mnemonic of 12/15/18/21/24 lowercase words)"
    ]);
  });

  it("rejects a malformed mnemonic without echoing its value", () => {
    const badValue = "Two Words";
    const result = parseT2Config({ E2E_WALLET_MNEMONIC: badValue });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.errors).toEqual(["E2E_WALLET_MNEMONIC must be a BIP-39 mnemonic of 12/15/18/21/24 lowercase words"]);
    for (const message of result.errors) {
      expect(message).not.toContain("Two");
      expect(message).not.toContain("Words");
    }
  });
});
