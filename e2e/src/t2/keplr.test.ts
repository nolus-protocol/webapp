import { describe, expect, it } from "vitest";
import type { StdSignDoc } from "@cosmjs/amino";
import { PUBLIC_FALLBACK_MNEMONIC } from "../config.js";
import { buildKeplrInitScript, buildSignAminoScript } from "./keplr.js";

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

  it("pins the getter's chain id onto the signer (the app's signer.chainId read)", () => {
    expect(script).toContain("const makeAminoSigner = (chainId) => ({");
    expect(script).toContain("chainId,");
    expect(script).toContain("getOfflineSignerOnlyAmino: (chainId) => makeAminoSigner(chainId)");
    expect(script).toContain("getOfflineSignerAuto: (chainId) => Promise.resolve(makeAminoSigner(chainId))");
  });

  it("threads the signer's chain id into the account binding for per-chain addresses", () => {
    expect(script).toMatch(/window\.__e2eWalletGetAccounts\(chainId\)/);
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

describe("buildSignAminoScript", () => {
  const SIGNER = "nolus1testaddressplaceholderxxxxxxxxxxxxxxxx";
  const SIGN_DOC: StdSignDoc = {
    chain_id: "nolus-probe-1",
    account_number: "1",
    sequence: "0",
    fee: { amount: [{ denom: "unls", amount: "500" }], gas: "200000" },
    msgs: [{ type: "cosmos-sdk/MsgSend", value: { from_address: SIGNER, to_address: SIGNER, amount: [] } }],
    memo: "probe-memo"
  };
  const script = buildSignAminoScript(SIGNER, SIGN_DOC);

  it("drives the amino getter and the signAmino method", () => {
    expect(script).toContain("getOfflineSignerOnlyAmino");
    expect(script).toContain("signAmino");
  });

  it("passes the signer address and sign doc through verbatim", () => {
    expect(script).toContain(JSON.stringify(SIGNER));
    expect(script).toContain(SIGN_DOC.chain_id);
    expect(script).toContain(SIGN_DOC.memo);
    expect(script).toContain(JSON.stringify(SIGN_DOC));
  });

  it("receives only an address and a doc, so it embeds no secret", () => {
    expect(script).not.toContain(PUBLIC_FALLBACK_MNEMONIC);
    for (const word of PUBLIC_FALLBACK_MNEMONIC.split(" ")) {
      expect(script).not.toContain(` ${word} `);
    }
  });
});
