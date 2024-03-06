import type { MultisigThresholdPubkey, Pubkey, SinglePubkey } from "@cosmjs/amino";
import { toBase64 } from "@cosmjs/encoding";
import {
  encodeEd25519Pubkey,
  encodeSecp256k1Pubkey,
  isEd25519Pubkey,
  isMultisigThresholdPubkey,
  isSecp256k1Pubkey
} from "@cosmjs/amino";
import { fromBase64 } from "@cosmjs/encoding";
import { Uint53 } from "@cosmjs/math";
import { PubKey as CosmosCryptoEd25519Pubkey } from "cosmjs-types/cosmos/crypto/ed25519/keys";
import { LegacyAminoPubKey } from "cosmjs-types/cosmos/crypto/multisig/keys";
import { PubKey as CosmosCryptoSecp256k1Pubkey } from "cosmjs-types/cosmos/crypto/secp256k1/keys";
import { Any } from "cosmjs-types/google/protobuf/any";

export interface EthSecp256k1Pubkey extends SinglePubkey {
  readonly type: "tendermint/PubKeyEthSecp256k1";
  readonly value: string;
}

export function encodeEthSecp256k1Pubkey(pubkey: Uint8Array): EthSecp256k1Pubkey {
  if (pubkey.length !== 33 || (pubkey[0] !== 0x02 && pubkey[0] !== 0x03)) {
    throw new Error("Public key must be compressed ethsecp256k1, i.e. 33 bytes starting with 0x02 or 0x03");
  }
  return {
    type: pubkeyType.ethsecp256k1,
    value: toBase64(pubkey)
  };
}

export const pubkeyType = {
  /** @see https://github.com/tendermint/tendermint/blob/v0.33.0/crypto/secp256k1/secp256k1.go#L23 */
  secp256k1: "tendermint/PubKeySecp256k1" as const,
  ethsecp256k1: "tendermint/PubKeyEthSecp256k1" as const,
  /** @see https://github.com/tendermint/tendermint/blob/v0.33.0/crypto/ed25519/ed25519.go#L22 */
  ed25519: "tendermint/PubKeyEd25519" as const,
  /** @see https://github.com/tendermint/tendermint/blob/v0.33.0/crypto/sr25519/codec.go#L12 */
  sr25519: "tendermint/PubKeySr25519" as const,
  multisigThreshold: "tendermint/PubKeyMultisigThreshold" as const
};

export function encodePubkey(pubkey: Pubkey): Any {
  if (isSecp256k1Pubkey(pubkey)) {
    const pubkeyProto = CosmosCryptoSecp256k1Pubkey.fromPartial({
      key: fromBase64(pubkey.value)
    });
    return Any.fromPartial({
      typeUrl: "/cosmos.crypto.secp256k1.PubKey",
      value: Uint8Array.from(CosmosCryptoSecp256k1Pubkey.encode(pubkeyProto).finish())
    });
  } else if (isEd25519Pubkey(pubkey)) {
    const pubkeyProto = CosmosCryptoEd25519Pubkey.fromPartial({
      key: fromBase64(pubkey.value)
    });
    return Any.fromPartial({
      typeUrl: "/cosmos.crypto.ed25519.PubKey",
      value: Uint8Array.from(CosmosCryptoEd25519Pubkey.encode(pubkeyProto).finish())
    });
  } else if (isEthSecp256k1Pubkey(pubkey)) {
    const pubkeyProto = CosmosCryptoSecp256k1Pubkey.fromPartial({
      key: fromBase64(pubkey.value)
    });
    return Any.fromPartial({
      typeUrl: "/ethermint.crypto.v1.ethsecp256k1.PubKey",
      value: Uint8Array.from(CosmosCryptoSecp256k1Pubkey.encode(pubkeyProto).finish())
    });
  } else if (isMultisigThresholdPubkey(pubkey)) {
    const pubkeyProto = LegacyAminoPubKey.fromPartial({
      threshold: Uint53.fromString(pubkey.value.threshold).toNumber(),
      publicKeys: pubkey.value.pubkeys.map(encodePubkey)
    });
    return Any.fromPartial({
      typeUrl: "/cosmos.crypto.multisig.LegacyAminoPubKey",
      value: Uint8Array.from(LegacyAminoPubKey.encode(pubkeyProto).finish())
    });
  } else {
    throw new Error(`Pubkey type ${pubkey.type} not recognized`);
  }
}

export function isEthSecp256k1Pubkey(pubkey: Pubkey): pubkey is EthSecp256k1Pubkey {
  return (pubkey as EthSecp256k1Pubkey).type === "tendermint/PubKeyEthSecp256k1";
}

export function decodePubkey(pubkey?: Any | null): Pubkey | null {
  if (!pubkey || !pubkey.value) {
    return null;
  }

  switch (pubkey.typeUrl) {
    case "/ethermint.crypto.v1.ethsecp256k1.PubKey":
    case "/cosmos.crypto.secp256k1.PubKey":
    case "/cosmos.crypto.ed25519.PubKey": {
      return anyToSinglePubkey(pubkey);
    }
    case "/cosmos.crypto.multisig.LegacyAminoPubKey": {
      const { threshold, publicKeys } = LegacyAminoPubKey.decode(pubkey.value);
      const out: MultisigThresholdPubkey = {
        type: "tendermint/PubKeyMultisigThreshold",
        value: {
          threshold: threshold.toString(),
          pubkeys: publicKeys.map(anyToSinglePubkey)
        }
      };
      return out;
    }
    default:
      throw new Error(`Pubkey type_url ${pubkey.typeUrl} not recognized`);
  }
}

export function anyToSinglePubkey(pubkey: Any): SinglePubkey {
  switch (pubkey.typeUrl) {
    case "/cosmos.crypto.ed25519.PubKey": {
      const { key } = CosmosCryptoEd25519Pubkey.decode(pubkey.value);
      return encodeEd25519Pubkey(key);
    }
    case "/ethermint.crypto.v1.ethsecp256k1.PubKey":
    case "/cosmos.crypto.secp256k1.PubKey": {
      const { key } = CosmosCryptoSecp256k1Pubkey.decode(pubkey.value);
      return encodeSecp256k1Pubkey(key);
    }
    default:
      throw new Error(`Pubkey type_url ${pubkey.typeUrl} not recognized as single public key type`);
  }
}
