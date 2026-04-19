import { describe, it, expect, vi } from "vitest";
import { AuthInfo, SignerInfo, ModeInfo, Fee } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { ensureEip191AuthInfoBytes, personalSignJSON } from "./sign";

function singleSignerAuthInfo(mode: SignMode): AuthInfo {
  return AuthInfo.fromPartial({
    fee: Fee.fromPartial({ amount: [{ amount: "100", denom: "unls" }], gasLimit: 200000n }),
    signerInfos: [
      SignerInfo.fromPartial({
        publicKey: { typeUrl: "/cosmos.crypto.secp256k1.PubKey", value: new Uint8Array([1, 2, 3]) },
        sequence: 5n,
        modeInfo: ModeInfo.fromPartial({ single: { mode } })
      })
    ]
  });
}

describe("ensureEip191AuthInfoBytes", () => {
  it("returns AuthInfo.encode unchanged when signer already uses SIGN_MODE_EIP_191", () => {
    const authInfo = singleSignerAuthInfo(SignMode.SIGN_MODE_EIP_191);
    const out = ensureEip191AuthInfoBytes(authInfo);
    const expected = AuthInfo.encode(authInfo).finish();
    expect(out).toEqual(expected);
  });

  it("patches a DIRECT-signed AuthInfo to EIP-191 mode, preserving sequence and pubkey", () => {
    const authInfo = singleSignerAuthInfo(SignMode.SIGN_MODE_DIRECT);
    const out = ensureEip191AuthInfoBytes(authInfo);

    const decoded = AuthInfo.decode(out);
    expect(decoded.signerInfos).toHaveLength(1);
    expect(decoded.signerInfos[0].modeInfo?.single?.mode).toBe(SignMode.SIGN_MODE_EIP_191);
    expect(decoded.signerInfos[0].sequence).toBe(5n);
    expect(decoded.signerInfos[0].publicKey?.typeUrl).toBe("/cosmos.crypto.secp256k1.PubKey");
  });

  it("patches AMINO-JSON to EIP-191", () => {
    const authInfo = singleSignerAuthInfo(SignMode.SIGN_MODE_LEGACY_AMINO_JSON);
    const decoded = AuthInfo.decode(ensureEip191AuthInfoBytes(authInfo));
    expect(decoded.signerInfos[0].modeInfo?.single?.mode).toBe(SignMode.SIGN_MODE_EIP_191);
  });

  it("preserves the original fee when patching", () => {
    const authInfo = singleSignerAuthInfo(SignMode.SIGN_MODE_DIRECT);
    const decoded = AuthInfo.decode(ensureEip191AuthInfoBytes(authInfo));
    expect(decoded.fee?.gasLimit).toBe(200000n);
    expect(decoded.fee?.amount).toEqual([{ amount: "100", denom: "unls" }]);
  });

  it("handles an empty signerInfos by still producing a valid encoded AuthInfo", () => {
    const authInfo = AuthInfo.fromPartial({
      fee: Fee.fromPartial({ gasLimit: 1n }),
      signerInfos: []
    });
    const out = ensureEip191AuthInfoBytes(authInfo);
    const decoded = AuthInfo.decode(out);
    // Empty signerInfos means the `already` check is false, and the patched
    // signerInfos has one entry with empty pubkey/sequence.
    expect(decoded.signerInfos).toHaveLength(1);
    expect(decoded.signerInfos[0].modeInfo?.single?.mode).toBe(SignMode.SIGN_MODE_EIP_191);
  });
});

describe("personalSignJSON", () => {
  const ETH_ADDR = "0x0000000000000000000000000000000000000001";

  it("sends a 0x-hex encoded JSON string to personal_sign and strips the v byte", async () => {
    // r (32 bytes) + s (32 bytes) + v (1 byte) = 65 bytes hex = 130 chars + "0x"
    const sigHex = "0x" + "aa".repeat(32) + "bb".repeat(32) + "1c";
    const request = vi.fn().mockResolvedValue(sigHex);
    const provider = { request } as unknown as Parameters<typeof personalSignJSON>[1];

    const rsBytes = await personalSignJSON({ foo: "bar" }, provider, ETH_ADDR);

    expect(request).toHaveBeenCalledTimes(1);
    const call = request.mock.calls[0][0];
    expect(call.method).toBe("personal_sign");
    expect(call.params[1]).toBe(ETH_ADDR);
    expect(call.params[0]).toMatch(/^0x[0-9a-fA-F]+$/);

    // r + s only — v byte stripped
    expect(rsBytes).toBeInstanceOf(Uint8Array);
    expect(rsBytes.length).toBe(64);
    expect(rsBytes[0]).toBe(0xaa);
    expect(rsBytes[31]).toBe(0xaa);
    expect(rsBytes[32]).toBe(0xbb);
    expect(rsBytes[63]).toBe(0xbb);
  });

  it("pretty-prints (4-space) the JSON passed to the signer", async () => {
    const sigHex = "0x" + "00".repeat(65);
    const request = vi.fn().mockResolvedValue(sigHex);
    const provider = { request } as unknown as Parameters<typeof personalSignJSON>[1];

    await personalSignJSON({ a: 1 }, provider, ETH_ADDR);
    const hexParam: string = request.mock.calls[0][0].params[0];
    // Decode back
    const body = hexParam.slice(2);
    const bytes = new Uint8Array(body.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(body.slice(i * 2, i * 2 + 2), 16);
    const text = new TextDecoder().decode(bytes);
    expect(text).toBe(JSON.stringify({ a: 1 }, null, 4));
  });

  it("propagates provider errors", async () => {
    const provider = {
      request: vi.fn().mockRejectedValue(new Error("user rejected"))
    } as unknown as Parameters<typeof personalSignJSON>[1];

    await expect(personalSignJSON({}, provider, ETH_ADDR)).rejects.toThrow(/user rejected/);
  });

  it("throws on hex strings with odd length (from malformed provider)", async () => {
    // 131-char (odd) — triggers the "Hex string must have an even length" branch
    const sigHex = "0x" + "a".repeat(131);
    const provider = {
      request: vi.fn().mockResolvedValue(sigHex)
    } as unknown as Parameters<typeof personalSignJSON>[1];
    await expect(personalSignJSON({}, provider, ETH_ADDR)).rejects.toThrow(/even length/);
  });
});
