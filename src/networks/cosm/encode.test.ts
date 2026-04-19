import { describe, it, expect } from "vitest";
import { toBase64 } from "@cosmjs/encoding";
import { Any } from "cosmjs-types/google/protobuf/any";
import type { Pubkey } from "@cosmjs/amino";
import { encodePubkey, decodePubkey } from "./encode";

// secp256k1 pubkeys must be exactly 33 bytes (compressed).
// ed25519 pubkeys must be exactly 32 bytes.
const SECP_KEY = new Uint8Array(33);
SECP_KEY[0] = 0x02; // compressed pubkey prefix
for (let i = 1; i < 33; i++) SECP_KEY[i] = i;
const SECP_KEY_B64 = toBase64(SECP_KEY);

const ED_KEY = new Uint8Array(32);
for (let i = 0; i < 32; i++) ED_KEY[i] = i + 1;
const ED_KEY_B64 = toBase64(ED_KEY);

describe("encodePubkey", () => {
  it("encodes a secp256k1 pubkey to /cosmos.crypto.secp256k1.PubKey Any", () => {
    const pubkey: Pubkey = { type: "tendermint/PubKeySecp256k1", value: SECP_KEY_B64 };
    const any = encodePubkey(pubkey);
    expect(any.typeUrl).toBe("/cosmos.crypto.secp256k1.PubKey");
    expect(any.value).toBeInstanceOf(Uint8Array);
    expect(any.value.length).toBeGreaterThan(0);
  });

  it("encodes an ed25519 pubkey to /cosmos.crypto.ed25519.PubKey Any", () => {
    const pubkey: Pubkey = { type: "tendermint/PubKeyEd25519", value: ED_KEY_B64 };
    const any = encodePubkey(pubkey);
    expect(any.typeUrl).toBe("/cosmos.crypto.ed25519.PubKey");
    expect(any.value).toBeInstanceOf(Uint8Array);
    expect(any.value.length).toBeGreaterThan(0);
  });

  it("encodes a multisig threshold pubkey recursively", () => {
    const pubkey: Pubkey = {
      type: "tendermint/PubKeyMultisigThreshold",
      value: {
        threshold: "2",
        pubkeys: [
          { type: "tendermint/PubKeySecp256k1", value: SECP_KEY_B64 },
          { type: "tendermint/PubKeySecp256k1", value: SECP_KEY_B64 }
        ]
      }
    };
    const any = encodePubkey(pubkey);
    expect(any.typeUrl).toBe("/cosmos.crypto.multisig.LegacyAminoPubKey");
    expect(any.value).toBeInstanceOf(Uint8Array);
  });

  it("throws for an unrecognized pubkey type", () => {
    const pubkey = { type: "tendermint/Unknown", value: "AAAA" } as unknown as Pubkey;
    expect(() => encodePubkey(pubkey)).toThrow(/not recognized/);
  });

  it("is a lossless round-trip for secp256k1", () => {
    const pubkey: Pubkey = { type: "tendermint/PubKeySecp256k1", value: SECP_KEY_B64 };
    const decoded = decodePubkey(encodePubkey(pubkey));
    expect(decoded).toEqual(pubkey);
  });
});

describe("decodePubkey", () => {
  it("returns null when pubkey is undefined", () => {
    expect(decodePubkey(undefined)).toBeNull();
  });

  it("returns null when pubkey is null", () => {
    expect(decodePubkey(null)).toBeNull();
  });

  it("returns null when pubkey.value is falsy (undefined on Any shape)", () => {
    // The production guard is `!pubkey.value`; Any's default from fromPartial gives a Uint8Array,
    // but an object crafted with an undefined `value` field triggers the null branch.
    const any = { typeUrl: "/cosmos.crypto.secp256k1.PubKey", value: undefined as unknown as Uint8Array };
    expect(decodePubkey(any as unknown as Any)).toBeNull();
  });

  it("decodes an ed25519 Any back to an amino pubkey", () => {
    const pubkey: Pubkey = { type: "tendermint/PubKeyEd25519", value: ED_KEY_B64 };
    const decoded = decodePubkey(encodePubkey(pubkey));
    expect(decoded).toEqual(pubkey);
  });

  it("decodes a multisig Any back to an amino multisig pubkey", () => {
    const pubkey: Pubkey = {
      type: "tendermint/PubKeyMultisigThreshold",
      value: {
        threshold: "2",
        pubkeys: [
          { type: "tendermint/PubKeySecp256k1", value: SECP_KEY_B64 },
          { type: "tendermint/PubKeyEd25519", value: ED_KEY_B64 }
        ]
      }
    };
    const decoded = decodePubkey(encodePubkey(pubkey));
    expect(decoded).toEqual(pubkey);
  });

  it("throws for an unrecognized typeUrl", () => {
    const any = Any.fromPartial({ typeUrl: "/some.unknown.PubKey", value: new Uint8Array([1, 2, 3]) });
    expect(() => decodePubkey(any)).toThrow(/not recognized/);
  });
});
