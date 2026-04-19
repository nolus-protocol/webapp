import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAsyncOperation } from "./useAsyncOperation";
import { ApiError } from "@/common/api/types/common";

describe("useAsyncOperation", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("starts with loading=false, empty error, and null errorDetails", () => {
    const { loading, error, errorDetails } = useAsyncOperation();
    expect(loading.value).toBe(false);
    expect(error.value).toBe("");
    expect(errorDetails.value).toBeNull();
  });

  it("flips loading to true during the call, then back to false after success", async () => {
    const { loading, run } = useAsyncOperation();
    let loadingDuring = false;
    const result = await run(async () => {
      loadingDuring = loading.value;
      return "ok";
    });
    expect(loadingDuring).toBe(true);
    expect(loading.value).toBe(false);
    expect(result).toBe("ok");
  });

  it("resets error + errorDetails at the start of a new run", async () => {
    const { error, errorDetails, run } = useAsyncOperation();
    await run(async () => {
      throw new Error("first");
    });
    expect(error.value).toBe("first");
    expect(errorDetails.value?.message).toBe("first");

    // next run — state should reset even before the callback runs
    let errDuring = "not-reset";
    let detailsDuring: unknown = "not-reset";
    await run(async () => {
      errDuring = error.value;
      detailsDuring = errorDetails.value;
      return 1;
    });
    expect(errDuring).toBe("");
    expect(detailsDuring).toBeNull();
  });

  it("populates ApiError fields (status, code) in errorDetails", async () => {
    const { error, errorDetails, run } = useAsyncOperation();
    const result = await run(async () => {
      throw new ApiError(429, "rate_limited", "slow down");
    });
    expect(result).toBeNull();
    expect(error.value).toBe("slow down");
    expect(errorDetails.value).toEqual({ message: "slow down", status: 429, code: "rate_limited" });
  });

  it("for non-ApiError, errorDetails omits status and code", async () => {
    const { errorDetails, run } = useAsyncOperation();
    await run(async () => {
      throw new Error("boom");
    });
    expect(errorDetails.value).toEqual({ message: "boom" });
    expect(errorDetails.value).not.toHaveProperty("status");
  });

  it("wraps non-Error thrown values (string, number) into Error messages", async () => {
    const { error, errorDetails, run } = useAsyncOperation();
    await run(async () => {
      throw "just a string";
    });
    expect(error.value).toBe("just a string");
    expect(errorDetails.value?.message).toBe("just a string");
  });

  it("logs caught exceptions to console.error", async () => {
    const { run } = useAsyncOperation();
    const err = new Error("logged");
    await run(async () => {
      throw err;
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith("[useAsyncOperation]", err);
  });

  it("always resets loading to false, even when the callback throws", async () => {
    const { loading, run } = useAsyncOperation();
    await run(async () => {
      throw new Error("x");
    });
    expect(loading.value).toBe(false);
  });
});
