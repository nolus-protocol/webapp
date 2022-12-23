import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { SigningCosmWasmClient, type SigningCosmWasmClientOptions } from '@cosmjs/cosmwasm-stargate';
import type { Coin, OfflineSigner } from '@cosmjs/proto-signing';
import { type DeliverTxResponse, type StdFee, GasPrice, calculateFee, type MsgSendEncodeObject } from '@cosmjs/stargate';

import { WalletManager } from "@/wallet/WalletManager";
import { EncryptionUtils } from "@/utils";
import { DirectSecp256k1Wallet } from "@cosmjs/proto-signing";
import { Buffer } from 'buffer';
import { TxRaw } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { sha256 } from "@cosmjs/crypto"
import { toHex, toUtf8 } from '@cosmjs/encoding';
import { encodeSecp256k1Pubkey } from '@cosmjs/amino';
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { MsgExecuteContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';

export class TestUtils {

    static password = '';
    static rpc = '';

    private static instance: {
        cosmWasmClient: CosmWasmClient,
        tmClient: Tendermint34Client,
        wallet: Wallet
    };

    private static async getData() {
        const encryptedPubKey = WalletManager.getEncryptedPubKey();
        const encryptedPk = WalletManager.getPrivateKey();
        const decryptedPubKey = EncryptionUtils.decryptEncryptionKey(encryptedPubKey, TestUtils.password);
        const decryptedPrivateKey = EncryptionUtils.decryptPrivateKey(encryptedPk, decryptedPubKey, TestUtils.password);
        const directSecrWallet = await DirectSecp256k1Wallet.fromKey(
            Buffer.from(decryptedPrivateKey, 'hex'),
            'nolus'
        );
        return directSecrWallet;
    }

    static async getInstance() {
        if (this.instance == null) {
            const data = await TestUtils.getData();
            const [cosmWasmClient, tmClient] = await Promise.all([CosmWasmClient.connect(TestUtils.rpc), Tendermint34Client.connect(TestUtils.rpc)]);
            const w = new Wallet(tmClient, data, { prefix: 'nolus' });
            this.instance = {
                wallet: w,
                cosmWasmClient: cosmWasmClient,
                tmClient: tmClient
            }

        }
        return this.instance;
    }

    static async sendTokens() {
        await this.instance.wallet.executeContract();
        // await this.instance.wallet.sendToken(coin(1, 'unls'), 'nolus16d4dzyf7xg5g4jzdhh4g85z290e2w5qmwzyts9');
        // const amt = coin(8000, 'unls');
        // const sendMsg = {
        //     typeUrl: "/cosmos.bank.v1beta1.MsgSend",
        //     value: {
        //         fromAddress: this.instance.wallet.address,
        //         toAddress: this.instance.wallet.address,
        //         amount: [amt],
        //     }
        // };


        // const client = await SigningStargateClient.connectWithSigner(TestUtils.rpc, this.instance.wallet.getOfflineSigner());
        // console.log(this.instance.wallet)
        // const gasEstimation = await client.simulate(this.instance.wallet.address as string, [sendMsg], "MSG");
        // const multiplier = 2;
        // let gasprice = GasPrice.fromString("0.0025unls");
        // let usedFee = calculateFee(Math.round(gasEstimation * multiplier), gasprice);

        // const txRaw = await client.sign(this.instance.wallet.address as string, [sendMsg], usedFee, "MSG");
        // const uint8Tx = Uint8Array.from(TxRaw.encode(txRaw).finish());
        // const txHash = toHex(sha256(uint8Tx));
        // console.log(txHash)

        // const tx = await client.broadcastTx(uint8Tx)
        // console.log(tx)

    }

}

export class Wallet extends SigningCosmWasmClient {

    address?: string;
    pubKey?: Uint8Array;
    algo?: string;
    multiplier = 2;
    gasprice = GasPrice.fromString("0.01unls");

    protected offlineSigner: OfflineSigner;

    constructor(tmClient: Tendermint34Client | undefined, signer: OfflineSigner, options: SigningCosmWasmClientOptions) {
        super(tmClient, signer, options);
        this.offlineSigner = signer;
        this.useAccount();
    }

    public async sendToken(coin: Coin, toAddress: string, memo: string = '') {

        const pubkey = encodeSecp256k1Pubkey(this.pubKey as Uint8Array);
        const msg = MsgSend.fromPartial({
            fromAddress: this.address,
            toAddress: toAddress,
            amount: [coin],
        });

        const msgAny = {
            typeUrl: "/cosmos.bank.v1beta1.MsgSend",
            value: msg,
        };

        const sequence = await this.sequence();
        const { gasInfo } = await this.forceGetQueryClient().tx.simulate([this.registry.encodeAsAny(msgAny)], memo, pubkey, sequence);
        const gas = Math.round(gasInfo?.gasUsed.toNumber() as number * this.multiplier);
        let usedFee = calculateFee(gas, this.gasprice);
        const txRaw = await this.sign(this.address as string, [msgAny], usedFee, memo);

        const uint8Tx = Uint8Array.from(TxRaw.encode(txRaw).finish());
        const txHash = toHex(sha256(uint8Tx));
        console.log(txHash)

        const tx = await this.broadcastTx(uint8Tx)
        console.log(tx)

    }

    public async executeContract(memo: string = ''){
        const pubkey = encodeSecp256k1Pubkey(this.pubKey as Uint8Array);
        const msg = MsgExecuteContract.fromPartial({
            sender: this.address,
            contract: "nolus1qg5ega6dykkxc307y25pecuufrjkxkaggkkxh7nad0vhyhtuhw3sqaa3c5",
            msg: toUtf8(JSON.stringify({ deposit: []})),
            funds: [{
                denom: 'ibc/7FBDBEEEBA9C50C4BCDF7BF438EAB99E64360833D240B32655C96E319559E911',
                amount: '1',
              }],
        });

        const msgAny = {
            typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract",
            value: msg,
        };

        const sequence = await this.sequence();
        const { gasInfo } = await this.forceGetQueryClient().tx.simulate([this.registry.encodeAsAny(msgAny)], memo, pubkey, sequence);
        console.log(gasInfo);

    }

    private async sequence() {
        try {
            const { sequence } = await this.getSequence(this.address as string);
            return sequence;
        } catch (error) {
            throw new Error('Insufficient amount of NLS');
        }
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

    public getOfflineSigner() {
        return this.offlineSigner;
    }

    public async transferAmount(receiverAddress: string, amount: Coin[], fee: StdFee | 'auto' | number, memo?: string): Promise<DeliverTxResponse> {
        if (!this.address) {
            throw new Error('Sender address is missing');
        }
        return this.sendTokens(this.address, receiverAddress, amount, fee, memo);
    }

}
