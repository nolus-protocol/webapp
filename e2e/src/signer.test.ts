import { describe, expect, it } from "vitest";
import type { StdSignDoc } from "@cosmjs/amino";
import { fromBase64, toBase64 } from "@cosmjs/encoding";
import { createWalletIdentity, verifyAminoSignature } from "./signer.js";

// A deliberately public, unfunded CosmJS test vector. The nolus1 address below was
// produced once by running the derivation and pinned here as the known-good expectation.
const TEST_MNEMONIC = "enlist hip relief stomach skate base shallow young switch frequent cry park";
const EXPECTED_ADDRESS = "nolus14qemq0vw6y3gc3u3e0aty2e764u4gs5l0p8z0c";

const SIGN_DOC: StdSignDoc = {
  chain_id: "nolus-1",
  account_number: "7",
  sequence: "3",
  fee: { amount: [{ denom: "unls", amount: "500" }], gas: "200000" },
  msgs: [
    {
      type: "cosmos-sdk/MsgSend",
      value: {
        from_address: EXPECTED_ADDRESS,
        to_address: EXPECTED_ADDRESS,
        amount: [{ denom: "unls", amount: "1000" }]
      }
    }
  ],
  memo: "unit"
};

describe("createWalletIdentity", () => {
  it("derives the pinned nolus1 address for the test vector", async () => {
    const identity = await createWalletIdentity(TEST_MNEMONIC);
    expect(identity.address).toBe(EXPECTED_ADDRESS);
  });

  it("returns a JSON-safe account payload with a 33-byte secp256k1 pubkey", async () => {
    const identity = await createWalletIdentity(TEST_MNEMONIC);
    const account = await identity.getAccounts();
    expect(account.address).toBe(EXPECTED_ADDRESS);
    expect(account.algo).toBe("secp256k1");
    expect(account.pubkey).toBe(identity.pubkeyBase64);
    expect(fromBase64(account.pubkey)).toHaveLength(33);
  });

  it("signs a byte-exact amino doc that verifies cryptographically", async () => {
    const identity = await createWalletIdentity(TEST_MNEMONIC);
    const response = await identity.signAmino(identity.address, SIGN_DOC);
    expect(response.signed).toEqual(SIGN_DOC);
    expect(response.signature.pub_key.value).toBe(identity.pubkeyBase64);
    expect(verifyAminoSignature(response)).toBe(true);
  });

  it("rejects a tampered signature", async () => {
    const identity = await createWalletIdentity(TEST_MNEMONIC);
    const response = await identity.signAmino(identity.address, SIGN_DOC);
    const bytes = fromBase64(response.signature.signature);
    bytes[0] = bytes[0] === undefined ? 0 : bytes[0] ^ 0xff;
    const tampered = {
      ...response,
      signature: { ...response.signature, signature: toBase64(bytes) }
    };
    expect(verifyAminoSignature(tampered)).toBe(false);
  });

  it("never serializes the mnemonic", async () => {
    const identity = await createWalletIdentity(TEST_MNEMONIC);
    const serialized = JSON.stringify(identity);
    expect(Object.keys(JSON.parse(serialized) as object).sort()).toEqual(["address", "pubkeyBase64"]);
    expect(serialized).not.toContain(TEST_MNEMONIC);
  });
});
