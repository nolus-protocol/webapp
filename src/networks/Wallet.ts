import type { Coin } from '@cosmjs/proto-signing';
import { StargateClient } from '@cosmjs/stargate';
import { Tendermint34Client } from '@cosmjs/tendermint-rpc';
import { accountFromAny } from './accountParser';

export class Wallet {
    protected stargateClient: StargateClient | undefined;
    protected tendermintClient: Tendermint34Client | undefined;

    private constructor() {}

    static async getInstance(tendermintRpc: string) {
        const wallet = new Wallet();
        await wallet.setInstance(tendermintRpc);
        return wallet;
    }

    private async setInstance(tendermintRpc: string) {
        const [stargateClient, tendermintClient] = await Promise.all([
            StargateClient.connect(tendermintRpc, {
                accountParser: accountFromAny
            }),
            Tendermint34Client.connect(tendermintRpc)
        ]);
        this.stargateClient = stargateClient;
        this.tendermintClient = tendermintClient;
    }

    destroy(){
        if(this.stargateClient){
            this.stargateClient?.disconnect();
        }
        if(this.tendermintClient){
            this.tendermintClient?.disconnect();
        }
    }

    public getChainId = async (): Promise<string> => {
        const client = this.stargateClient;
        const chainId = await client?.getChainId();
        if (!chainId) {
            throw new Error('Chain ID is missing!');
        }
        return chainId;
    };

    public async getBalance(address: string, denom: string): Promise<Coin> {
        const client = this.stargateClient;
        const balance = client?.getBalance(address, denom);
        if (!balance) {
            throw new Error('Balance is missing!');
        }
        return await balance;
    }

    public async getBlockHeight(): Promise<number> {
        const client = this.stargateClient;
        const block = await client?.getBlock();
        if (!block?.header) {
            throw new Error('Block height is missing!');
        }
        return block?.header.height;
    }

    public getTendermintClient(){
        return this.tendermintClient;
    }

    public getStargateClient(){
        return this.stargateClient;
    }
}
