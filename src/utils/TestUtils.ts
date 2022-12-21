import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { SigningCosmWasmClient, type SigningCosmWasmClientOptions } from '@cosmjs/cosmwasm-stargate';
import type { Coin, OfflineSigner } from '@cosmjs/proto-signing';
import type { DeliverTxResponse, StdFee } from '@cosmjs/stargate';

export class TestUtils {

    private static instance: {
        cosmWasmClient: CosmWasmClient,
        tmClient: Tendermint34Client
    };


    private constructor(tendermintRpc: string, password: string) {
        TestUtils.setInstances(tendermintRpc, password);
    }

    private static async setInstances(tendermintRpc: string, password: string) {
        try {
            const [cosmWasmClient, tmClient] = await Promise.all([CosmWasmClient.connect(tendermintRpc), Tendermint34Client.connect(tendermintRpc)]);
            TestUtils.instance = {
                cosmWasmClient, 
                tmClient
            }
        } catch (error) {
            throw new Error(error as string);
        }
    }

    static getInstance() {
        if (this.instance === null) {
            throw new Error('Set the Tendermint RPC address before getting instance');
        }
        return this.instance;
    }

}

export class Wallet extends SigningCosmWasmClient {

    address?: string;
    pubKey?: Uint8Array;
    algo?: string;

    protected offlineSigner: OfflineSigner;

    constructor(tmClient: Tendermint34Client | undefined, signer: OfflineSigner, options: SigningCosmWasmClientOptions) {
        super(tmClient, signer, options);
        this.offlineSigner = signer;
    }

    public async transferAmount(receiverAddress: string, amount: Coin[], fee: StdFee | 'auto' | number, memo?: string): Promise<DeliverTxResponse> {
        if (!this.address) {
            throw new Error('Sender address is missing');
        }
        return this.sendTokens(this.address, receiverAddress, amount, fee, memo);
    }

}
