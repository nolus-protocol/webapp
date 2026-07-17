import { describe, expect, it } from "vitest";
import { planLeaseDownpayment } from "./leasePlan.js";
import type { ProtocolConfig } from "./leasePlan.js";
import { Decimal } from "../../oracle/decimal.js";

const d = (value: string): Decimal => Decimal.fromString(value);

const LONG: ProtocolConfig = {
  protocol: "OSMOSIS-OSMOSIS-USDC_NOBLE",
  ranges: [
    { currency: "ATOM", minUsd: d("45") },
    { currency: "OSMO", minUsd: d("40") },
    { currency: "WETH", minUsd: d("50") }
  ]
};
const SHORT: ProtocolConfig = { protocol: "OSMOSIS-OSMOSIS-OSMO", ranges: [{ currency: "OSMO", minUsd: d("40") }] };
const EMPTY: ProtocolConfig = { protocol: "NEUTRON-ASTROPORT-EMPTY", ranges: [] };

function base(overrides: Partial<Parameters<typeof planLeaseDownpayment>[0]>) {
  return planLeaseDownpayment({
    protocols: [LONG, SHORT],
    heldUsd: new Map(),
    usdcUsd: d("0"),
    acquireTarget: "OSMO",
    acquireBufferUsd: d("5"),
    ...overrides
  });
}

describe("planLeaseDownpayment", () => {
  it("prefers a held ranged asset that covers its min", () => {
    const plan = base({ heldUsd: new Map([["OSMO", d("42")]]) });
    expect(plan).toEqual({ kind: "use-held", protocol: "OSMOSIS-OSMOSIS-USDC_NOBLE", asset: "OSMO", minUsd: d("40") });
  });

  it("does not use a held asset below its min", () => {
    const plan = base({ heldUsd: new Map([["OSMO", d("39.99")]]), usdcUsd: d("100") });
    expect(plan.kind).toBe("acquire");
  });

  it("plans to acquire the target when nothing is held and USDC covers min + buffer", () => {
    const plan = base({ usdcUsd: d("50") });
    expect(plan).toEqual({
      kind: "acquire",
      protocol: "OSMOSIS-OSMOSIS-USDC_NOBLE",
      asset: "OSMO",
      minUsd: d("40"),
      acquireUsd: d("45")
    });
  });

  it("skips when nothing is held and USDC cannot cover the acquisition", () => {
    const plan = base({ usdcUsd: d("44.99") });
    expect(plan.kind).toBe("skip");
    if (plan.kind === "skip") {
      expect(plan.reason).toMatch(/below the 45.00 needed to acquire OSMO/);
    }
  });

  it("skips when every protocol config is empty or failed (no ranges)", () => {
    const plan = planLeaseDownpayment({
      protocols: [EMPTY],
      heldUsd: new Map([["OSMO", d("100")]]),
      usdcUsd: d("100"),
      acquireTarget: "OSMO",
      acquireBufferUsd: d("5")
    });
    expect(plan).toEqual({
      kind: "skip",
      reason: "no eligible lease protocol (every config was empty or failed to load)"
    });
  });

  it("skips when no eligible protocol ranges the acquire target", () => {
    const plan = planLeaseDownpayment({
      protocols: [{ protocol: "P", ranges: [{ currency: "ATOM", minUsd: d("45") }] }],
      heldUsd: new Map(),
      usdcUsd: d("100"),
      acquireTarget: "OSMO",
      acquireBufferUsd: d("5")
    });
    expect(plan).toEqual({ kind: "skip", reason: "no eligible protocol ranges the acquire target OSMO" });
  });
});
