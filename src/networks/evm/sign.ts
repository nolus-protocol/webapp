import type { Eip1193Provider } from "ethers";
import { AuthInfo, SignerInfo, ModeInfo } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { toUtf8Bytes } from "ethers";
import { toHex } from "@cosmjs/encoding";

export function ensureEip191AuthInfoBytes(authInfo: AuthInfo): Uint8Array {
  const si = authInfo.signerInfos?.[0];
  const already = si?.modeInfo?.single?.mode === SignMode.SIGN_MODE_EIP_191;
  if (already) return AuthInfo.encode(authInfo).finish();

  const patched = AuthInfo.fromPartial({
    fee: authInfo.fee,
    signerInfos: [
      SignerInfo.fromPartial({
        publicKey: si?.publicKey,
        sequence: si?.sequence,
        modeInfo: ModeInfo.fromPartial({ single: { mode: SignMode.SIGN_MODE_EIP_191 } })
      })
    ]
  });
  return AuthInfo.encode(patched).finish();
}

export async function personalSignJSON(
  jsonObj: unknown,
  ethereum: Eip1193Provider,
  ethAddress: string
): Promise<Uint8Array> {
  const json = JSON.stringify(jsonObj, null, 4);
  const hex = `0x${toHex(toUtf8Bytes(json))}`;
  const sigHex: string = await ethereum.request({ method: "personal_sign", params: [hex, ethAddress] });
  const raw = sigHex.slice(2);
  const rsHex = raw.slice(0, raw.length - 2);
  const rsBytes = hexToBytes(rsHex);
  return rsBytes;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("Hex string must have an even length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
