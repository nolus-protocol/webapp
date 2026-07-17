import { describe, expect, it } from "vitest";
import { capDenomOf, USDC_DENOM } from "./denoms.js";

describe("capDenomOf", () => {
  it("maps the cap denoms and the native/USDC chain denoms by exact match", () => {
    expect(capDenomOf("nls")).toBe("nls");
    expect(capDenomOf("unls")).toBe("nls");
    expect(capDenomOf("usdc")).toBe("usdc");
    expect(capDenomOf(USDC_DENOM)).toBe("usdc");
  });

  it("returns undefined for any other denom — no substring match", () => {
    expect(capDenomOf("uatom")).toBeUndefined();
    expect(capDenomOf("ibc/usdcfoo")).toBeUndefined();
    expect(capDenomOf("usdcx")).toBeUndefined();
  });
});
