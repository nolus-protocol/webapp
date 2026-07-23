import { sha256 } from "@cosmjs/crypto";
import { bech32 } from "bech32";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { toHex } from "@cosmjs/encoding";

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
import { NetworkEnv } from "@/common/utils";
import { fetchEndpoints } from "@/common/utils/EndpointService";
import { KeplrEmbedChainInfo } from "@/config/global";
import type { AccountData, DirectSignResponse, OfflineDirectSigner, Algo, Registry } from "@cosmjs/proto-signing";
import { WalletTypes } from "../types";
import { type API, type NetworkData } from "@/common/types";
import { StargateClient } from "@cosmjs/stargate";
import type { Window } from "../window";
import { PubKey as Ed25519PubKey } from "cosmjs-types/cosmos/crypto/ed25519/keys";
import { encodeEd25519Pubkey } from "@cosmjs/amino";

import type { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import type { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import type { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import type { MsgDelegate, MsgUndelegate, MsgBeginRedelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import type { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import type { MsgVote } from "cosmjs-types/cosmos/gov/v1beta1/tx";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { VersionedTransaction } from "@solana/web3.js";
import type { SendOptions } from "@solana/web3.js";
import { Buffer } from "buffer";

interface SolanaProviderPublicKey {
  toBytes(): Uint8Array;
  toBase58(): string;
}

interface SolanaProvider {
  connect(): Promise<unknown>;
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
  signAndSendTransaction(transaction: VersionedTransaction, options?: SendOptions): Promise<{ signature: string }>;
  publicKey: SolanaProviderPublicKey | null | undefined;
}

type SolanaWalletErrorKind = "rejected" | "dialog-open" | "disconnected" | "unknown";

export class SolanaWalletError extends Error {
  readonly kind: SolanaWalletErrorKind;

  constructor(kind: SolanaWalletErrorKind, message: string, cause: unknown) {
    super(message, { cause });
    this.name = "SolanaWalletError";
    this.kind = kind;
  }
}

// Standard injected-wallet JSON-RPC error codes (EIP-1193 style), surfaced by
// both Phantom and Solflare.
const USER_REJECTED_REQUEST_CODE = 4001;
const REQUEST_ALREADY_PENDING_CODE = -32002;

function providerErrorCode(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "number") {
    return error.code;
  }
  return undefined;
}

function toSolanaWalletError(cause: unknown): SolanaWalletError {
  const code = providerErrorCode(cause);
  if (code === USER_REJECTED_REQUEST_CODE) {
    return new SolanaWalletError("rejected", "The wallet rejected the transaction.", cause);
  }
  if (code === REQUEST_ALREADY_PENDING_CODE) {
    return new SolanaWalletError("dialog-open", "A wallet approval request is already pending.", cause);
  }
  return new SolanaWalletError("unknown", "The wallet could not sign and send the transaction.", cause);
}

function isSolanaProvider(value: unknown): value is SolanaProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "connect" in value &&
    typeof value.connect === "function" &&
    "signMessage" in value &&
    typeof value.signMessage === "function"
  );
}

function accountPrefix(chainInfo: unknown): string {
  if (typeof chainInfo !== "object" || chainInfo === null || !("bech32Config" in chainInfo)) {
    throw new Error("Chain info is missing its bech32 config.");
  }
  const config = chainInfo.bech32Config;
  if (typeof config !== "object" || config === null || !("bech32PrefixAccAddr" in config)) {
    throw new Error("Chain info is missing its bech32 config.");
  }
  const prefix = config.bech32PrefixAccAddr;
  if (typeof prefix !== "string") {
    throw new Error("Chain info bech32 account prefix is not a string.");
  }
  return prefix;
}

function parseSequenceInfo(value: unknown): { accountNumber: bigint | number; sequence: bigint | number } {
  if (typeof value === "object" && value !== null && "accountNumber" in value && "sequence" in value) {
    const { accountNumber, sequence } = value;
    if (
      (typeof accountNumber === "bigint" || typeof accountNumber === "number") &&
      (typeof sequence === "bigint" || typeof sequence === "number")
    ) {
      return { accountNumber, sequence };
    }
  }
  throw new Error("Account sequence info is missing accountNumber or sequence.");
}

interface SimulatedFee {
  amount: { denom: string; amount: string }[];
  gas: string;
}

function isCoin(value: unknown): value is { denom: string; amount: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "denom" in value &&
    typeof value.denom === "string" &&
    "amount" in value &&
    typeof value.amount === "string"
  );
}

function isSimulatedFee(value: unknown): value is SimulatedFee {
  return (
    typeof value === "object" &&
    value !== null &&
    "amount" in value &&
    Array.isArray(value.amount) &&
    value.amount.every(isCoin) &&
    "gas" in value &&
    typeof value.gas === "string"
  );
}

export class SolanaWallet implements Wallet {
  address!: string;
  pubKey?: Uint8Array;
  algo?: Algo = "ed25519";
  explorer: string = "";
  solAddress?: string;
  type: string = WalletTypes.svm;
  chainId: string = "";

  private readonly providerKind: "solflare" | "phantom";

  constructor(provider: "solflare" | "phantom") {
    this.providerKind = provider;
  }

  private getProvider(): SolanaProvider {
    if (this.providerKind === "solflare") {
      const provider = (window as Window).solflare;
      if (!provider || provider.isSolflare !== true || !isSolanaProvider(provider)) {
        throw new Error("Solflare wallet is not installed.");
      }
      return provider;
    }

    const provider = (window as Window).phantom?.solana;
    if (!provider || provider.isPhantom !== true || !isSolanaProvider(provider)) {
      throw new Error("Phantom wallet is not installed.");
    }
    return provider;
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
      NetworkEnv.getStoredNetworkName(),
      chainId,
      networkConfig.rpc as string,
      networkConfig.api as string
    );
    const data = await this.getWallet(chainInfo);
    this.address = data.bech32Addr;
    this.chainId = chainId;
    return data;
  }

  async signAndSendTransaction(transactionBase64: string): Promise<string> {
    let provider: SolanaProvider;
    try {
      provider = this.getProvider();
    } catch (error) {
      throw new SolanaWalletError("disconnected", "No Solana wallet provider is available.", error);
    }

    if (typeof provider.signAndSendTransaction !== "function") {
      throw new SolanaWalletError(
        "unknown",
        "The connected wallet version does not support sending Solana transactions.",
        undefined
      );
    }

    let signature: string;
    try {
      const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, "base64"));
      ({ signature } = await provider.signAndSendTransaction(transaction));
    } catch (error) {
      throw toSolanaWalletError(error);
    }

    if (typeof signature !== "string" || signature.length === 0) {
      throw new SolanaWalletError(
        "unknown",
        "The wallet returned no transaction signature, violating the signAndSendTransaction contract.",
        undefined
      );
    }
    return signature;
  }

  private async getWallet(chainInfo: unknown) {
    const provider = this.getProvider();

    const isConnected = await provider.connect();
    if (!isConnected || !provider.publicKey) {
      throw new Error("Connection failed—user rejected or no publicKey available.");
    }

    const publicKey = provider.publicKey;
    const ed25519PublicKey = publicKey.toBytes();
    const solAddress = publicKey.toBase58();

    const hashBytes = sha256(ed25519PublicKey);
    const addressBytes = hashBytes.slice(0, 20);
    const bech32Addr = bech32.encode(accountPrefix(chainInfo), bech32.toWords(addressBytes));
    const pubkeyProtoBytes = Ed25519PubKey.encode({ key: ed25519PublicKey }).finish();

    this.pubKey = ed25519PublicKey;
    this.address = bech32Addr;
    this.solAddress = solAddress;
    return { solAddress, pubkeyAny: pubkeyProtoBytes, bech32Addr };
  }

  makeWCOfflineSigner(): OfflineDirectSigner & {
    type: WalletTypes;
    chainId: string;
    // Method syntax (not property syntax) is load-bearing: it keeps parameter checks
    // bivariant so the precisely-typed implementations below satisfy these members,
    // while NolusWallet can still attach its own host functions at runtime.
    simulateMultiTx?(...args: unknown[]): unknown;
    simulateTx?(...args: unknown[]): unknown;
    getSequence?(...args: unknown[]): unknown;
    getGasInfo?(...args: unknown[]): unknown;
    registry?: Registry;
  } {
    const address = this.address;
    const pubkey = this.pubKey;
    const algo = this.algo;
    const chainId = this.chainId;
    const provider = this.getProvider();
    if (pubkey === undefined || algo === undefined) {
      throw new Error("Wallet is not connected: public key or algo is missing.");
    }
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
        memo: string = ""
      ) {
        if (this.simulateMultiTx === undefined) {
          throw new Error("simulateMultiTx is not attached to this signer.");
        }
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
        memo: string = ""
      ) {
        if (this.getSequence === undefined || this.getGasInfo === undefined || this.registry === undefined) {
          throw new Error("Signer host functions are not attached: getSequence, getGasInfo or registry is missing.");
        }
        const registry = this.registry;
        const { accountNumber, sequence } = parseSequenceInfo(await this.getSequence());
        const anyMsgs = messages.map((m) => registry.encodeAsAny({ typeUrl: m.msgTypeUrl, value: m.msg }));

        const txBody = TxBody.fromPartial({
          messages: anyMsgs,
          memo
        });
        const txBodyBytes = TxBody.encode(txBody).finish();
        const publicKey = {
          typeUrl: "/cosmos.crypto.ed25519.PubKey",
          value: Ed25519PubKey.encode({ key: pubkey }).finish()
        };

        const gasEstimate = await this.getGasInfo(messages, memo, encodeEd25519Pubkey(pubkey), sequence);
        if (
          typeof gasEstimate !== "object" ||
          gasEstimate === null ||
          !("usedFee" in gasEstimate) ||
          !isSimulatedFee(gasEstimate.usedFee)
        ) {
          throw new Error("Gas estimation did not return a usable fee.");
        }
        const usedFee = gasEstimate.usedFee;
        const feeProto = Fee.fromPartial({
          amount: usedFee.amount,
          gasLimit: BigInt(usedFee.gas)
        });

        const authInfo = AuthInfo.fromPartial({
          signerInfos: [
            SignerInfo.fromPartial({
              publicKey,
              modeInfo: { single: { mode: SignMode.SIGN_MODE_DIRECT } },
              sequence: BigInt(sequence)
            })
          ],
          fee: feeProto
        });
        const authInfoBytes = AuthInfo.encode(authInfo).finish();

        const signDoc = SignDoc.fromPartial({
          bodyBytes: txBodyBytes,
          authInfoBytes: authInfoBytes,
          chainId,
          accountNumber: BigInt(accountNumber)
        });
        const signBytes = SignDoc.encode(signDoc).finish();

        const { signature } = await provider.signMessage(signBytes);

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

      async signDirect(_: string, _signDoc: ProtoSignDoc): Promise<DirectSignResponse> {
        throw "not supported";
      }
    };
  }
}
