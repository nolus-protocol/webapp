import { describe, expect, it } from "vitest";
import {
  UNBONDING_ENTRY_CAP,
  buildSwapRouteRequest,
  hasSwapRoute,
  isNoRouteFailure,
  pickUnbondingValidator,
  remainsAboveMin,
  resolveDownpaymentFloorUsd,
  unbondingEntryGate
} from "./preconditions.js";

describe("buildSwapRouteRequest", () => {
  it("builds a forward POST body with both chain ids set to the Nolus chain", () => {
    expect(
      buildSwapRouteRequest({
        sourceDenom: "unls",
        destDenom: "ibc/ED07",
        amountMicro: "45000000",
        chainId: "pirin-1"
      })
    ).toEqual({
      source_asset_denom: "unls",
      source_asset_chain_id: "pirin-1",
      dest_asset_denom: "ibc/ED07",
      dest_asset_chain_id: "pirin-1",
      amount_in: "45000000"
    });
  });
});

describe("unbondingEntryGate", () => {
  it("has room below the cap and none at or above it", () => {
    expect(unbondingEntryGate(6)).toEqual({ ok: true, entries: 6, cap: UNBONDING_ENTRY_CAP });
    expect(unbondingEntryGate(7).ok).toBe(false);
    expect(unbondingEntryGate(8).ok).toBe(false);
  });
});

describe("pickUnbondingValidator", () => {
  it("rotates to the first validator with entry headroom", () => {
    const target = pickUnbondingValidator([
      { validatorAddress: "nolusvaloper1full", entries: 7 },
      { validatorAddress: "nolusvaloper2open", entries: 2 }
    ]);
    expect(target).toBe("nolusvaloper2open");
  });

  it("returns undefined when every validator is saturated", () => {
    expect(
      pickUnbondingValidator([
        { validatorAddress: "a", entries: 7 },
        { validatorAddress: "b", entries: 9 }
      ])
    ).toBeUndefined();
  });
});

describe("hasSwapRoute", () => {
  it("accepts a positive amount-out at the top level or under a wrapper", () => {
    expect(hasSwapRoute({ amount_out: "1000" })).toBe(true);
    expect(hasSwapRoute({ route: { amount_out: "5" } })).toBe(true);
    expect(hasSwapRoute({ quote: { amount_out: "42" } })).toBe(true);
  });

  it("rejects a missing, zero, or non-numeric amount-out", () => {
    expect(hasSwapRoute({})).toBe(false);
    expect(hasSwapRoute({ amount_out: "0" })).toBe(false);
    expect(hasSwapRoute({ amount_out: "none" })).toBe(false);
    expect(hasSwapRoute(null)).toBe(false);
  });
});

describe("isNoRouteFailure", () => {
  it("classifies a Skip routing failure (code or message) as a no-route", () => {
    expect(isNoRouteFailure('POST /api/swap/route returned HTTP 502: {"code":"SWAP_ROUTE_FAILED"}')).toBe(true);
    expect(isNoRouteFailure("no routes found for the requested pair")).toBe(true);
    expect(isNoRouteFailure("Error: no route available")).toBe(true);
  });

  it("leaves a genuine network/API error as an error", () => {
    expect(isNoRouteFailure("POST /api/swap/route returned HTTP 500: internal error")).toBe(false);
    expect(isNoRouteFailure("connect ECONNREFUSED")).toBe(false);
    expect(isNoRouteFailure("returned a non-JSON body")).toBe(false);
  });
});

describe("resolveDownpaymentFloorUsd", () => {
  it("returns the floor for a named currency from the wire's numeric object map", () => {
    const payload = { downpayment_ranges: { USDC: { min: 40.0, max: 800.0 }, ATOM: { min: 45.0, max: 4000.0 } } };
    expect(resolveDownpaymentFloorUsd(payload, "USDC").toString(2)).toBe("40.00");
  });

  it("returns the highest floor across currencies when none is named", () => {
    const payload = {
      downpayment_ranges: [
        { ticker: "USDC", min: 40.0 },
        { ticker: "ATOM", min: 45.0 }
      ]
    };
    expect(resolveDownpaymentFloorUsd(payload).toString(2)).toBe("45.00");
  });

  it("still accepts string-encoded minimums", () => {
    const payload = { downpayment_ranges: { USDC: { min: "40.0" } } };
    expect(resolveDownpaymentFloorUsd(payload, "USDC").toString(2)).toBe("40.00");
  });

  it("throws when no ranges parse so a drifted shape is a red", () => {
    expect(() => resolveDownpaymentFloorUsd({})).toThrow(/no downpayment ranges/);
  });
});

describe("remainsAboveMin", () => {
  it("holds when the residual meets the minimum and fails below it", () => {
    expect(remainsAboveMin(15_000_000n, 15_000_000n)).toBe(true);
    expect(remainsAboveMin(14_999_999n, 15_000_000n)).toBe(false);
  });
});
