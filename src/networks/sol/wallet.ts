import { sha256 } from "@cosmjs/crypto";
import { bech32 } from "bech32";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { toBase64, toHex } from "@cosmjs/encoding";

import {
  AuthInfo,
  Fee,
  SignDoc,
  SignerInfo,
  TxBody,
  TxRaw,
  type SignDoc as ProtoSignDoc
} from "cosmjs-types/cosmos/tx/v1beta1/tx";
import type { Wallet } from "../wallet";
import { EnvNetworkUtils } from "@/common/utils";
import { fetchEndpoints } from "@/common/utils/EndpointService";
import { KeplrEmbedChainInfo } from "@/config/global";
import type { AccountData, DirectSignResponse, OfflineDirectSigner, Algo, Registry } from "@cosmjs/proto-signing";
import type { ChainInfo } from "@keplr-wallet/types";
import { WalletTypes } from "../types";
import { type API, type NetworkData } from "@/common/types";
import { StargateClient } from "@cosmjs/stargate";
import type { Window } from "../metamask/window";
import { PubKey as Ed25519PubKey } from "cosmjs-types/cosmos/crypto/ed25519/keys";
import { encodeEd25519Pubkey } from "@cosmjs/amino";

import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { MsgDelegate, MsgUndelegate, MsgBeginRedelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgVote } from "cosmjs-types/cosmos/gov/v1beta1/tx";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";

export class SolanaWallet implements Wallet {
  address!: string;
  pubKey?: Uint8Array;
  algo?: Algo = "ed25519";
  explorer: string;
  solAddress?: string;
  type: string = WalletTypes.svm;
  chainId: string;

  constructor() {}

  private getProvider() {
    return (window as Window).solflare;
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

  async connect() {
    const networkConfig = await fetchEndpoints(ChainConstants.CHAIN_KEY);
    NolusClient.setInstance(networkConfig.rpc);
    const chainId = await NolusClient.getInstance().getChainId();
    const chainInfo = KeplrEmbedChainInfo(
      EnvNetworkUtils.getStoredNetworkName(),
      chainId,
      networkConfig.rpc as string,
      networkConfig.api as string
    );
    const data = await this.getWallet(chainInfo);
    this.address = data.bech32Addr;
    this.chainId = chainId;
    return data;
  }

  private async getWallet(chainInfo: ChainInfo) {
    const provider = this.getProvider();

    const isConnected = await provider!.connect();
    if (!isConnected || !provider?.publicKey) {
      throw new Error("Connection failed—user rejected or no publicKey available.");
    }

    const publicKey = provider!.publicKey;
    const ed25519PublicKey = publicKey.toBytes();
    const solAddress = publicKey.toBase58();

    const hashBytes = sha256(ed25519PublicKey);
    const addressBytes = hashBytes.slice(0, 20);
    const bech32Addr = bech32.encode(chainInfo.bech32Config.bech32PrefixAccAddr, bech32.toWords(addressBytes));
    const pubkeyProtoBytes = Ed25519PubKey.encode({ key: ed25519PublicKey }).finish();

    this.pubKey = ed25519PublicKey;
    this.address = bech32Addr;
    this.solAddress = solAddress;
    return { solAddress, pubkeyAny: pubkeyProtoBytes, bech32Addr };
  }

  makeWCOfflineSigner(): OfflineDirectSigner & {
    type: WalletTypes;
    chainId: string;
    simulateMultiTx?: Function;
    simulateTx?: Function;
    getSequence?: Function;
    getGasInfo?: Function;
    registry?: Registry;
  } {
    const address = this.address;
    const pubkey = this.pubKey;
    const algo = this.algo;
    const chainId = this.chainId;
    const provider = this.getProvider();
    return {
      type: WalletTypes.svm,
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

      async simulateTx(
        msg:
          | MsgSend
          | MsgExecuteContract
          | MsgTransfer
          | MsgDelegate
          | MsgBeginRedelegate
          | MsgUndelegate
          | MsgVote
          | MsgWithdrawDelegatorReward,
        msgTypeUrl: string,
        memo = ""
      ): Promise<any> {
        return this.simulateMultiTx([{ msg, msgTypeUrl }], memo);
      },

      async simulateMultiTx(
        messages: {
          msg:
            | MsgSend
            | MsgExecuteContract
            | MsgTransfer
            | MsgDelegate
            | MsgBeginRedelegate
            | MsgUndelegate
            | MsgVote
            | MsgWithdrawDelegatorReward;
          msgTypeUrl: string;
        }[],
        memo = ""
      ): Promise<any> {
        const { accountNumber, sequence } = await this.getSequence();
        const anyMsgs = messages.map((m) => this.registry.encodeAsAny({ typeUrl: m.msgTypeUrl, value: m.msg }));

        const txBody = TxBody.fromPartial({
          messages: anyMsgs,
          memo
        });
        const txBodyBytes = TxBody.encode(txBody).finish();
        const publicKey = {
          typeUrl: "/cosmos.crypto.ed25519.PubKey",
          value: Ed25519PubKey.encode({ key: pubkey }).finish()
        };

        const { gasInfo, gas, usedFee } = await this.getGasInfo(messages, memo, encodeEd25519Pubkey(pubkey), sequence);
        const feeProto = Fee.fromPartial({
          amount: usedFee.amount,
          gasLimit: BigInt(usedFee.gas)
        });

        const authInfo = AuthInfo.fromPartial({
          signerInfos: [
            SignerInfo.fromPartial({
              publicKey,
              modeInfo: { single: { mode: SignMode.SIGN_MODE_DIRECT } },
              sequence
            })
          ],
          fee: feeProto
        });
        const authInfoBytes = AuthInfo.encode(authInfo).finish();

        const signDoc = SignDoc.fromPartial({
          bodyBytes: txBodyBytes,
          authInfoBytes: authInfoBytes,
          chainId,
          accountNumber
        });
        const signBytes = SignDoc.encode(signDoc).finish();

        const { signature } = await provider!.signMessage(signBytes);

        const txRaw = TxRaw.fromPartial({
          bodyBytes: txBodyBytes,
          authInfoBytes: authInfoBytes,
          signatures: [signature]
        });

        const txBytes = TxRaw.encode(txRaw).finish();
        const txHash = toHex(sha256(txBytes));

        return {
          txHash,
          txBytes,
          usedFee
        };
      },

      async signDirect(_: string, signDoc: ProtoSignDoc): Promise<DirectSignResponse> {
        throw "not supported";
      }
    };
  }
}
