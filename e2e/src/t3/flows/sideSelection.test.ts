import { describe, expect, it } from "vitest";
import {
  dayOfYearUtc,
  parityLeaseSide,
  resolveLeaseSideSetting,
  resolveLeaseSides,
  resolveShortLeaseStable
} from "./sideSelection.js";

describe("dayOfYearUtc", () => {
  it("returns 1 on the first day of the year", () => {
    expect(dayOfYearUtc(new Date("2026-01-01T00:00:00.000Z"))).toBe(1);
  });

  it("counts through to a mid-year date in UTC", () => {
    expect(dayOfYearUtc(new Date("2026-07-17T23:59:59.000Z"))).toBe(198);
  });

  it("is unaffected by a local-evening timestamp that is still the same UTC day", () => {
    expect(dayOfYearUtc(new Date("2026-03-01T00:00:00.000Z"))).toBe(60);
  });
});

describe("parityLeaseSide", () => {
  it("opens a long on an even day-of-year and a short on an odd one", () => {
    expect(parityLeaseSide(198)).toBe("long");
    expect(parityLeaseSide(197)).toBe("short");
  });
});

describe("resolveLeaseSideSetting", () => {
  it("returns an undefined setting when the override is unset or blank", () => {
    expect(resolveLeaseSideSetting(undefined)).toEqual({ ok: true, setting: undefined });
    expect(resolveLeaseSideSetting("  ")).toEqual({ ok: true, setting: undefined });
  });

  it("accepts each named side case-insensitively", () => {
    expect(resolveLeaseSideSetting("LONG")).toEqual({ ok: true, setting: "long" });
    expect(resolveLeaseSideSetting("short")).toEqual({ ok: true, setting: "short" });
    expect(resolveLeaseSideSetting("Both")).toEqual({ ok: true, setting: "both" });
  });

  it("rejects an unrecognized value instead of silently defaulting", () => {
    const result = resolveLeaseSideSetting("sideways");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("E2E_LEASE_SIDE");
    }
  });
});

describe("resolveLeaseSides", () => {
  it("falls back to the parity pick when the setting is undefined", () => {
    expect(resolveLeaseSides(undefined, 198)).toEqual(["long"]);
    expect(resolveLeaseSides(undefined, 197)).toEqual(["short"]);
  });

  it("returns the single pinned side", () => {
    expect(resolveLeaseSides("short", 198)).toEqual(["short"]);
  });

  it("expands both to long then short", () => {
    expect(resolveLeaseSides("both", 198)).toEqual(["long", "short"]);
  });
});

describe("resolveShortLeaseStable", () => {
  it("returns the ticker of the first lease-group currency", () => {
    const currencies = [
      { ticker: "USDC", group: "lpn" },
      { ticker: "ST_ATOM", group: "lease" },
      { ticker: "NLS", group: "native" }
    ];
    expect(resolveShortLeaseStable(currencies)).toBe("ST_ATOM");
  });

  it("throws when no lease-group currency is present", () => {
    expect(() => resolveShortLeaseStable([{ ticker: "USDC", group: "lpn" }])).toThrow(/lease-group/);
  });

  it("throws on a non-array payload", () => {
    expect(() => resolveShortLeaseStable(undefined)).toThrow(/lease-group/);
  });
});
