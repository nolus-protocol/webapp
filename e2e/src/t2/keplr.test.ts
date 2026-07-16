import { describe, expect, it } from "vitest";
import { PUBLIC_FALLBACK_MNEMONIC } from "../config.js";
import { buildKeplrInitScript } from "./keplr.js";

describe("buildKeplrInitScript", () => {
  const script = buildKeplrInitScript();

  it("defines exactly the four methods the app calls", () => {
    for (const method of ["enable", "experimentalSuggestChain", "getOfflineSignerOnlyAmino", "getOfflineSignerAuto"]) {
      expect(script).toContain(`${method}:`);
    }
  });

  it("omits every method the app never calls", () => {
    for (const absent of ["getKey", "signArbitrary", "defaultOptions", "signDirect", "enigmaEncrypt"]) {
      expect(script).not.toContain(absent);
    }
  });

  it("exposes no isKeplr identity marker (the #155 pin)", () => {
    expect(script).not.toContain("isKeplr");
  });

  it("takes no arguments, so it can never receive or embed a secret", () => {
    expect(buildKeplrInitScript).toHaveLength(0);
    expect(script).not.toContain(PUBLIC_FALLBACK_MNEMONIC);
    for (const word of PUBLIC_FALLBACK_MNEMONIC.split(" ")) {
      expect(script).not.toContain(` ${word} `);
    }
  });
});
