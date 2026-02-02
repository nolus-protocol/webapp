import { getBytes, hashMessage, hexlify, SigningKey, type Eip1193Provider, toUtf8Bytes } from "ethers";
import { PubKey as PubKeyProto } from "cosmjs-types/cosmos/crypto/secp256k1/keys";
import { ripemd160, sha256 } from "@cosmjs/crypto";
import { bech32 } from "bech32";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { toBase64 } from "@cosmjs/encoding";

import { AuthInfo, TxBody, type SignDoc as ProtoSignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import type { Wallet } from "../wallet";
import { EnvNetworkUtils, WalletManager } from "@/common/utils";
import { fetchEndpoints } from "@/common/utils/EndpointService";
import { KeplrEmbedChainInfo } from "@/config/global";
import type { AccountData, DirectSignResponse, OfflineDirectSigner, Algo } from "@cosmjs/proto-signing";
import type { ChainInfo } from "@keplr-wallet/types";
import { anyToLegacy, reorderCoinsDeep } from "../utilities";
import { ensureEip191AuthInfoBytes, personalSignJSON } from "./sign";
import { WalletTypes } from "../types";
import { WalletConnectMechanism, type API, type NetworkData } from "@/common/types";
import { StargateClient } from "@cosmjs/stargate";
import type { Window as MetamaskWindow } from "../metamask/window";

export class MetaMaskWallet implements Wallet {
  address!: string;
  pubKey?: Uint8Array;
  algo?: Algo = "secp256k1";
  explorer: string;
  ethAddress?: string;
  type: string = WalletTypes.evm;
  chainId: string;

  constructor() {}

  private getProvider(provider?: string) {
    const p = WalletManager.getWalletConnectMechanism() ?? provider;
    switch (p) {
      case WalletConnectMechanism.EVM_PHANTOM: {
        return (window as MetamaskWindow)?.phantom?.ethereum;
      }
      default: {
        const p0 = (window as MetamaskWindow)?.ethereum?.providers?.pop?.();
        if (p0) {
          return p0;
        }
        return (window as MetamaskWindow)?.ethereum;
      }
    }
  }

  async getChainId() {
    return this.chainId;
  }

  async connectCustom(networkConfig: API, network: NetworkData) {
    const stargate = await StargateClient.connect(networkConfig.rpc);

    const chainId = await stargate.getChainId();
    const chainInfo = network.embedChainInfo(chainId, networkConfig.rpc, networkConfig.api);

    const data = await this.getWallet(chainInfo);
    this.address = data.bech32Addr;
    this.chainId = chainId;
    return data;
  }

  async connect(provider: string) {
    const networkConfig = await fetchEndpoints(ChainConstants.CHAIN_KEY);
    NolusClient.setInstance(networkConfig.rpc);
    const chainId = await NolusClient.getInstance().getChainId();
    const chainInfo = KeplrEmbedChainInfo(
      EnvNetworkUtils.getStoredNetworkName(),
      chainId,
      networkConfig.rpc as string,
      networkConfig.api as string
    );
    const data = await this.getWallet(chainInfo, provider);
    this.address = data.bech32Addr;
    this.chainId = chainId;
    return data;
  }

  private async getWallet(chainInfo: ChainInfo, provider?: string) {
    const ethereum = this.getProvider(provider) as Eip1193Provider;

    await ethereum.request({ method: "eth_requestAccounts" });
    const ethAddress = (await ethereum.request({ method: "eth_accounts" }))[0];

    const message = "Generate address";
    const sig: string = await ethereum.request({
      method: "personal_sign",
      params: [hexlify(toUtf8Bytes(message)), ethAddress]
    });

    const digest = hashMessage(message);
    const fullPubkey = SigningKey.recoverPublicKey(digest, sig);

    const uncompressed = getBytes(fullPubkey);
    const x = uncompressed.slice(1, 33);
    const y = uncompressed.slice(33);
    const compressed = new Uint8Array(33);
    compressed[0] = y[y.length - 1]! % 2 ? 0x03 : 0x02;
    compressed.set(x, 1);

    const pubkeyProtoBytes = PubKeyProto.encode({ key: compressed }).finish();

    const sha = sha256(compressed);
    const rip = ripemd160(sha);
    const bech32Addr = bech32.encode(chainInfo.bech32Config.bech32PrefixAccAddr, bech32.toWords(rip));
    this.pubKey = compressed;
    this.address = bech32Addr;
    this.ethAddress = ethAddress;
    return { ethAddress, pubkeyAny: pubkeyProtoBytes, bech32Addr };
  }

  makeWCOfflineSigner(): OfflineDirectSigner & { type: WalletTypes; chainId: string } {
    const address = this.address;
    const pubkey = this.pubKey;
    const algo = this.algo;
    const ethAddress = this.ethAddress;
    const ethereum = this.getProvider() as Eip1193Provider;
    const chainId = this.chainId;

    return {
      type: WalletTypes.evm,
      chainId,
      async getAccounts(): Promise<readonly AccountData[]> {
        return [
          {
            address,
            algo,
            pubkey
          }
        ];
      },

      async signDirect(_: string, signDoc: ProtoSignDoc): Promise<DirectSignResponse> {
        const txBody = TxBody.decode(signDoc.bodyBytes);
        const authInfo = AuthInfo.decode(signDoc.authInfoBytes);
        const signerInfo = authInfo.signerInfos?.[0];

        const origAuthInfo = AuthInfo.decode(signDoc.authInfoBytes);
        const authInfoBytes = ensureEip191AuthInfoBytes(origAuthInfo);

        const msgs = txBody.messages.map(anyToLegacy);
        const feeAmount = (authInfo.fee?.amount ?? []).map((c) => ({ amount: c.amount, denom: c.denom }));
        const gas = authInfo.fee?.gasLimit?.toString?.() ?? "0";
        const memo = txBody.memo ?? "";

        const jsonForSigning = reorderCoinsDeep({
          account_number: signDoc.accountNumber.toString(),
          chain_id: signDoc.chainId,
          fee: { amount: feeAmount, gas },
          memo,
          msgs,
          sequence: signerInfo.sequence?.toString?.() ?? "0"
        });

        const rsBytes = await personalSignJSON(jsonForSigning, ethereum, ethAddress);

        return {
          signed: {
            chainId: signDoc.chainId,
            accountNumber: BigInt(signDoc.accountNumber.toString()),
            authInfoBytes,
            bodyBytes: signDoc.bodyBytes
          },
          signature: {
            pub_key: {
              type: "/cosmos.crypto.secp256k1.PubKey",
              value: pubkey
            },
            signature: toBase64(rsBytes)
          }
        };
      }
    };
  }
}
