import { describe, expect, it } from "vitest";
import { decideTerminal } from "./terminalSignal.js";

const surface = (over: Partial<Parameters<typeof decideTerminal>[0]>) => ({
  toastVisible: false,
  errorVisible: false,
  errorText: "",
  confirmVisible: false,
  ...over
});

describe("decideTerminal", () => {
  it("resolves success on a toast", () => {
    expect(decideTerminal(surface({ toastVisible: true }))).toEqual({ kind: "success" });
  });

  it("prefers a success toast over a lingering error surface (committed tx is never a failure)", () => {
    expect(decideTerminal(surface({ toastVisible: true, errorVisible: true, errorText: "stale" }))).toEqual({
      kind: "success"
    });
  });

  it("throws-worthy error carries the inline error text, or a fallback", () => {
    expect(decideTerminal(surface({ errorVisible: true, errorText: "  Insufficient balance  " }))).toEqual({
      kind: "error",
      text: "Insufficient balance"
    });
    expect(decideTerminal(surface({ errorVisible: true, errorText: "   " }))).toEqual({
      kind: "error",
      text: "form error"
    });
  });

  it("asks to click a confirm control only when no terminal surface is present yet", () => {
    expect(decideTerminal(surface({ confirmVisible: true }))).toEqual({ kind: "click-confirm" });
  });

  it("is pending when nothing is visible", () => {
    expect(decideTerminal(surface({}))).toEqual({ kind: "pending" });
  });
});
