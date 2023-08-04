import type { OfflineSigner } from '@cosmjs/proto-signing';
import type { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import type { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin';
import type { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';

import Long from 'long';
import { toHex } from '@cosmjs/encoding';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { TxRaw } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { encodeSecp256k1Pubkey, type StdFee } from '@cosmjs/amino';
import { sha256 } from '@cosmjs/crypto';
import { MsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { SigningCosmWasmClient, type SigningCosmWasmClientOptions } from '@cosmjs/cosmwasm-stargate';
import { calculateFee, type DeliverTxResponse } from '@cosmjs/stargate';

export class BaseWallet extends SigningCosmWasmClient {
    address?: string;
    pubKey?: Uint8Array;
    algo?: string;

    protected offlineSigner: OfflineSigner;

    constructor(tmClient: Tendermint34Client | undefined, signer: OfflineSigner, options: SigningCosmWasmClientOptions) {
        super(tmClient, signer, options);
        this.offlineSigner = signer;
    }

    private async simulateTx(msg: MsgSend | MsgExecuteContract | MsgTransfer, msgTypeUrl: string, gasMuplttiplier: number, gasPrice: string,  memo = '') {
        const pubkey = encodeSecp256k1Pubkey(this.pubKey as Uint8Array);
        const msgAny = {
            typeUrl: msgTypeUrl,
            value: msg,
        };

        const sequence = await this.sequence();
        const { gasInfo } = await this.forceGetQueryClient().tx.simulate([this.registry.encodeAsAny(msgAny)], memo, pubkey, sequence);

        const gas = Math.round((gasInfo?.gasUsed.toNumber() as number) * gasMuplttiplier);
        const usedFee = calculateFee(gas, gasPrice);
        const txRaw = await this.sign(this.address as string, [msgAny], usedFee, memo);

        const txBytes = Uint8Array.from(TxRaw.encode(txRaw).finish());
        const txHash = toHex(sha256(txBytes));

        return {
            txHash,
            txBytes,
            usedFee,
        };
    }

    public async useAccount(): Promise<boolean> {
        const accounts = await this.offlineSigner.getAccounts();
        if (accounts.length === 0) {
            throw new Error('Missing account');
        }
        this.address = accounts[0].address;
        this.pubKey = accounts[0].pubkey;
        this.algo = accounts[0].algo;

        return true;
    }

    public async transferAmount(receiverAddress: string, amount: Coin[], fee: StdFee | 'auto' | number, memo: string = ''): Promise<DeliverTxResponse> {
        if (!this.address) {
            throw new Error('Sender address is missing');
        }
        return this.sendTokens(this.address, receiverAddress, amount, fee, memo);
    }

    public async simulateBankTransferTx(toAddress: string, amount: Coin[], gasMuplttiplier: number, gasPrice: string, memo = '') {
        const msg = MsgSend.fromPartial({
            fromAddress: this.address,
            toAddress,
            amount,
        });

        return await this.simulateTx(msg, '/cosmos.bank.v1beta1.MsgSend', gasMuplttiplier, gasPrice);
    }

    public async simulateSendIbcTokensTx({
        toAddress,
        amount,
        sourcePort,
        sourceChannel,
        timeOut,
        gasMuplttiplier, 
        gasPrice,
        memo = '',
    }: {
        toAddress: string,
        amount: Coin,
        sourcePort: string,
        sourceChannel: string,
        timeOut: number,
        gasMuplttiplier: number, 
        gasPrice: string,
        memo?: string,
    }) {
        const timeOutData = Math.floor(Date.now() / 1000) + timeOut;
        const longTimeOut = Long.fromNumber(timeOutData).multiply(1_000_000_000)

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

        return await this.simulateTx(msg, '/ibc.applications.transfer.v1.MsgTransfer', gasMuplttiplier, gasPrice, "");
    }

    private async sequence() {
        try {  
            const { sequence } = await this.getSequence(this.address as string);
            return sequence;
        } catch (error) {
            console.log(error)
            throw new Error('Insufficient amount');
        }
    }

}
