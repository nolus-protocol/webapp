import type { EncodeObject, OfflineSigner, TxBodyEncodeObject } from "@cosmjs/proto-signing";
import type { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";
import type { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import type { Secp256k1Pubkey } from "@cosmjs/amino/build/pubkeys";
import type { AuthExtension, BankExtension, SignerData, StakingExtension, TxExtension } from "@cosmjs/stargate";
import type { Wallet } from "../wallet";
import type { CometClient } from "@cosmjs/tendermint-rpc";

import { toHex } from "@cosmjs/encoding";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { encodeSecp256k1Pubkey, type StdFee } from "@cosmjs/amino";

import { sha256 } from "@cosmjs/crypto";
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { SigningCosmWasmClient, type SigningCosmWasmClientOptions } from "@cosmjs/cosmwasm-stargate";
import { accountFromAny } from "./accountParser";
import { encodeEthSecp256k1Pubkey, encodePubkey, type EthSecp256k1Pubkey } from "./encode";
import { SUPPORTED_NETWORKS_DATA } from "../config";
import { isOfflineDirectSigner, makeAuthInfoBytes, makeSignDoc } from "@cosmjs/proto-signing";

import { makeSignDoc as makeSignDocAmino } from "@cosmjs/amino";
import { fromBase64 } from "@cosmjs/encoding";
import { Int53 } from "@cosmjs/math";
import { assert } from "@cosmjs/utils";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { Logger } from "@/common/utils";
import { simulateIBCTrasnferInj } from "../list/injective/tx";
import { setupTxExtension } from "./setupTxExtension";

import {
  calculateFee,
  type DeliverTxResponse,
  QueryClient,
  setupAuthExtension,
  setupBankExtension,
  setupStakingExtension
} from "@cosmjs/stargate";
import type { MsgDelegate, MsgUndelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import type { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgDepositForBurnWithCaller } from "../list/noble/tx";

export class BaseWallet extends SigningCosmWasmClient implements Wallet {
  address!: string;
  pubKey?: Uint8Array;
  algo?: string;
  rpc: string;
  api: string;
  prefix: string;
  queryClientBase: QueryClient & AuthExtension & BankExtension & StakingExtension & TxExtension;
  gasMultiplier: number;
  explorer: string;

  protected gasPriceData: string;
  protected offlineSigner: OfflineSigner;

  constructor(
    tmClient: CometClient | undefined,
    signer: OfflineSigner,
    options: SigningCosmWasmClientOptions,
    rpc: string,
    api: string,
    prefix: string,
    gasMultiplier: number,
    gasPrice: string,
    explorer: string
  ) {
    super(tmClient, signer, options);
    this.offlineSigner = signer;
    this.rpc = rpc;
    this.api = api;
    this.prefix = prefix;
    this.gasPriceData = gasPrice;
    this.gasMultiplier = gasMultiplier;
    this.explorer = explorer;
    this.queryClientBase = QueryClient.withExtensions(
      tmClient!,
      setupAuthExtension,
      setupBankExtension,
      setupStakingExtension,
      setupTxExtension
    );
    this.registerMessages();
  }

  private registerMessages() {
    this.registry.register("/circle.cctp.v1.MsgDepositForBurnWithCaller", MsgDepositForBurnWithCaller);
  }

  async getSigner() {
    return this.offlineSigner;
  }

  async simulateTx(
    msg: MsgSend | MsgExecuteContract | MsgTransfer,
    msgTypeUrl: string,
    gasMultiplier: number,
    gasPrice: string,
    memo = "",
    gasData?: { gasWanted: number; gasUsed: number }
  ) {
    const pubkey = this.getPubKey();

    const msgAny = {
      typeUrl: msgTypeUrl,
      value: msg
    };

    const sequence = await this.sequence();
    const gasInfo = gasData ?? (await this.getGas(msgAny, memo, pubkey, sequence));
    const gas = Math.round(Number(gasInfo?.gasUsed) * (this.gasMultiplier ?? gasMultiplier));
    const usedFee = calculateFee(gas, this.gasPriceData ?? gasPrice);
    const txRaw = await this.sign(this.address as string, [msgAny], usedFee, memo);

    const txBytes = Uint8Array.from(TxRaw.encode(txRaw).finish());
    const txHash = toHex(sha256(txBytes));
    return {
      txHash,
      txBytes,
      usedFee
    };
  }

  private async getGas(
    msgAny: {
      typeUrl: string;
      value: MsgSend | MsgExecuteContract | MsgTransfer;
    },
    memo: string,
    pubkey: EthSecp256k1Pubkey | Secp256k1Pubkey,
    sequence: { sequence?: number; accountNumber?: number }
  ) {
    const { gasInfo } = await this.queryClientBase.tx.simulate(
      [this.registry.encodeAsAny(msgAny)],
      memo,
      pubkey,
      sequence.sequence!
    );
    return gasInfo;
  }

  private getPubKey(pubKey?: Uint8Array) {
    switch (this.prefix) {
      case SUPPORTED_NETWORKS_DATA.EVMOS.prefix: {
        return encodeEthSecp256k1Pubkey(pubKey ?? (this.pubKey as Uint8Array));
      }
      case SUPPORTED_NETWORKS_DATA.DYMENSION.prefix: {
        return encodeEthSecp256k1Pubkey(pubKey ?? (this.pubKey as Uint8Array));
      }
      case SUPPORTED_NETWORKS_DATA.INJECTIVE.prefix: {
        return encodeEthSecp256k1Pubkey(pubKey ?? (this.pubKey as Uint8Array));
      }
      case SUPPORTED_NETWORKS_DATA.CUDOS.prefix: {
        return encodeEthSecp256k1Pubkey(pubKey ?? (this.pubKey as Uint8Array));
      }
      default: {
        return encodeSecp256k1Pubkey(pubKey ?? (this.pubKey as Uint8Array));
      }
    }
  }

  public async useAccount(): Promise<boolean> {
    const accounts = await this.offlineSigner.getAccounts();
    if (accounts.length === 0) {
      throw new Error("Missing account");
    }
    this.address = accounts[0].address;
    this.pubKey = accounts[0].pubkey;
    this.algo = accounts[0].algo;

    return true;
  }

  public async transferAmount(
    receiverAddress: string,
    amount: Coin[],
    fee: StdFee | "auto" | number,
    memo: string = ""
  ): Promise<DeliverTxResponse> {
    if (!this.address) {
      throw new Error("Sender address is missing");
    }
    return this.sendTokens(this.address, receiverAddress, amount, fee, memo);
  }

  public async simulateBankTransferTx(
    toAddress: string,
    amount: Coin[],
    gasMultiplier: number,
    gasPrice: string,
    memo = ""
  ) {
    const msg = MsgSend.fromPartial({
      fromAddress: this.address,
      toAddress,
      amount
    });

    return await this.simulateTx(msg, "/cosmos.bank.v1beta1.MsgSend", gasMultiplier, gasPrice);
  }

  public async simulateSendIbcTokensTx({
    toAddress,
    amount,
    sourcePort,
    sourceChannel,
    timeOut,
    gasMultiplier,
    gasPrice,
    memo = ""
  }: {
    toAddress: string;
    amount: Coin;
    sourcePort: string;
    sourceChannel: string;
    timeOut: number;
    gasMultiplier: number;
    gasPrice: string;
    memo?: string;
  }) {
    const timeOutData = Math.floor(Date.now() / 1000) + timeOut;
    const longTimeOut = BigInt(timeOutData) * 1_000_000_000n;

    const msg = MsgTransfer.fromPartial({
      sourcePort,
      sourceChannel,
      sender: this.address?.toString(),
      receiver: toAddress,
      token: amount,
      timeoutHeight: undefined,
      timeoutTimestamp: longTimeOut,
      memo
    });

    if (this.prefix == SUPPORTED_NETWORKS_DATA.INJECTIVE.prefix) {
      const { sequence, accountNumber } = await this.sequence();

      const data = await simulateIBCTrasnferInj(this.getPubKey(), sequence!, accountNumber!, {
        toAddress: toAddress,
        amount: amount,
        sender: this.address?.toString() as string,
        sourcePort,
        sourceChannel,
        memo
      });
      return await this.simulateTx(
        msg,
        "/ibc.applications.transfer.v1.MsgTransfer",
        gasMultiplier,
        gasPrice,
        "",
        data.gasInfo
      );
    }

    return await this.simulateTx(msg, "/ibc.applications.transfer.v1.MsgTransfer", gasMultiplier, gasPrice, "");
  }

  private async sequence() {
    try {
      const account = await this.getAccount(this.address!);

      return { sequence: account?.sequence, accountNumber: account?.accountNumber };
    } catch (error) {
      Logger.error(error);
      throw new Error("Insufficient amount");
    }
  }

  async getAccount(searchAddress: string) {
    try {
      const account = await this.queryClientBase.auth.account(searchAddress);

      //@ts-ignore
      return account ? (0, accountFromAny)(account) : null;
    } catch (error: Error | any) {
      if (/rpc error: code = NotFound/i.test(error.toString())) {
        return null;
      }
      throw error;
    }
  }

  public async sign(
    signerAddress: string,
    messages: readonly EncodeObject[],
    fee: StdFee,
    memo: string,
    explicitSignerData?: SignerData
  ): Promise<TxRaw> {
    let signerData: SignerData;
    if (explicitSignerData) {
      signerData = explicitSignerData;
    } else {
      const { accountNumber, sequence } = await this.getSequence(signerAddress);
      const chainId = await this.getChainId();
      signerData = {
        accountNumber: accountNumber,
        sequence: sequence,
        chainId: chainId
      };
    }

    return isOfflineDirectSigner(this.offlineSigner)
      ? this.signDirectBase(signerAddress, messages, fee, memo, signerData)
      : this.signAminoBase(signerAddress, messages, fee, memo, signerData);
  }

  private async signAminoBase(
    signerAddress: string,
    messages: readonly EncodeObject[],
    fee: StdFee,
    memo: string,
    { accountNumber, sequence, chainId }: SignerData
  ): Promise<TxRaw> {
    assert(!isOfflineDirectSigner(this.offlineSigner));
    const accountFromSigner = (await this.offlineSigner.getAccounts()).find(
      (account) => account.address === signerAddress
    );
    if (!accountFromSigner) {
      throw new Error("Failed to retrieve account from signer");
    }
    const pubkey = encodePubkey(this.getPubKey(accountFromSigner.pubkey), this.prefix);
    const signMode = SignMode.SIGN_MODE_LEGACY_AMINO_JSON;
    //@ts-ignore
    const msgs = messages.map((msg) => this.aminoTypes.toAmino(msg));
    const signDoc = makeSignDocAmino(msgs, fee, chainId, memo, accountNumber, sequence);
    const { signature, signed } = await this.offlineSigner.signAmino(signerAddress, signDoc);
    const signedTxBody: TxBodyEncodeObject = {
      typeUrl: "/cosmos.tx.v1beta1.TxBody",
      value: {
        //@ts-ignore
        messages: signed.msgs.map((msg) => this.aminoTypes.fromAmino(msg)),
        memo: signed.memo
      }
    };
    const signedTxBodyBytes = this.registry.encode(signedTxBody);
    const signedGasLimit = Int53.fromString(signed.fee.gas).toNumber();
    const signedSequence = Int53.fromString(signed.sequence).toNumber();
    const signedAuthInfoBytes = makeAuthInfoBytes(
      [{ pubkey, sequence: signedSequence }],
      signed.fee.amount,
      signedGasLimit,
      signed.fee.granter,
      signed.fee.payer,
      signMode
    );
    return TxRaw.fromPartial({
      bodyBytes: signedTxBodyBytes,
      authInfoBytes: signedAuthInfoBytes,
      signatures: [fromBase64(signature.signature)]
    });
  }

  private async signDirectBase(
    signerAddress: string,
    messages: readonly EncodeObject[],
    fee: StdFee,
    memo: string,
    { accountNumber, sequence, chainId }: SignerData
  ): Promise<TxRaw> {
    assert(isOfflineDirectSigner(this.offlineSigner));
    const accountFromSigner = (await this.offlineSigner.getAccounts()).find(
      (account) => account.address === signerAddress
    );
    if (!accountFromSigner) {
      throw new Error("Failed to retrieve account from signer");
    }
    const pubkey = encodePubkey(this.getPubKey(accountFromSigner.pubkey), this.prefix);
    const txBody: TxBodyEncodeObject = {
      typeUrl: "/cosmos.tx.v1beta1.TxBody",
      value: {
        messages: messages,
        memo: memo
      }
    };
    const txBodyBytes = this.registry.encode(txBody);
    const gasLimit = Int53.fromString(fee.gas).toNumber();
    const authInfoBytes = makeAuthInfoBytes([{ pubkey, sequence }], fee.amount, gasLimit, fee.granter, fee.payer);
    const signDoc = makeSignDoc(txBodyBytes, authInfoBytes, chainId, accountNumber);
    const { signature, signed } = await this.offlineSigner.signDirect(signerAddress, signDoc);
    return TxRaw.fromPartial({
      bodyBytes: signed.bodyBytes,
      authInfoBytes: signed.authInfoBytes,
      signatures: [fromBase64(signature.signature)]
    });
  }

  async simulateMultiTx(
    messages: {
      msg: MsgSend | MsgExecuteContract | MsgTransfer | MsgDelegate | MsgUndelegate | MsgWithdrawDelegatorReward;
      msgTypeUrl: string;
    }[],
    memo = ""
  ) {
    const pubkey = encodeSecp256k1Pubkey(this.pubKey as Uint8Array);
    const encodedMSGS = [];
    const msgs = [];

    for (const item of messages) {
      const msgAny = {
        typeUrl: item.msgTypeUrl,
        value: item.msg
      };
      encodedMSGS.push(this.registry.encodeAsAny(msgAny));
      msgs.push(msgAny);
    }

    const sequence = await this.sequence();
    const { gasInfo } = await this.forceGetQueryClient().tx.simulate(encodedMSGS, memo, pubkey, sequence?.sequence!);

    const gas = Math.round(Number(gasInfo?.gasUsed ?? 0) * this.gasMultiplier);
    const usedFee = calculateFee(gas, this.gasPriceData);
    const txRaw = await this.sign(this.address as string, msgs, usedFee, memo);

    const txBytes = Uint8Array.from(TxRaw.encode(txRaw).finish());
    const txHash = toHex(sha256(txBytes));

    return {
      txHash,
      txBytes,
      usedFee
    };
  }
}
