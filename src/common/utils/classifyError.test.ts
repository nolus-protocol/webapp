import { describe, it, expect } from "vitest";
import { ApiError } from "@/common/api";
import { classifyError } from "./classifyError";

describe("classifyError", () => {
  it("maps a SWAP_ROUTE_FAILED ApiError to the swap-route-failed key", () => {
    expect(classifyError(new ApiError(400, "SWAP_ROUTE_FAILED", "no route found"))).toBe("message.swap-route-failed");
  });

  it("maps a 429 ApiError to the rate-limit-exceeded key", () => {
    expect(classifyError(new ApiError(429, "rate_limited", "Too many requests"))).toBe("message.rate-limit-exceeded");
  });

  it("prefers the swap-route code over the 429 status when both apply", () => {
    expect(classifyError(new ApiError(429, "SWAP_ROUTE_FAILED", "throttled route"))).toBe("message.swap-route-failed");
  });

  it("maps a liquidity error message to no-liquidity (case-insensitive)", () => {
    expect(classifyError(new Error("query wasm contract failed: No Liquidity for this pair"))).toBe(
      "message.no-liquidity"
    );
  });

  it("classifies a liquidity ApiError without a special code/status via its message", () => {
    expect(classifyError(new ApiError(500, "unknown_error", "insufficient liquidity"))).toBe("message.no-liquidity");
  });

  it("maps an unrecognised Error to the generic unexpected-error", () => {
    expect(classifyError(new Error("invalid downpayment ticker"))).toBe("message.unexpected-error");
  });

  it("maps a non-Error throwable to unexpected-error", () => {
    expect(classifyError("boom")).toBe("message.unexpected-error");
    expect(classifyError(undefined)).toBe("message.unexpected-error");
  });
});
