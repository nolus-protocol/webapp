import type { Coin } from '@0xsquid/sdk/node_modules/@cosmjs/proto-signing';
import { StargateClient } from '@0xsquid/sdk/node_modules/@cosmjs/stargate';
import { Tendermint34Client } from '@0xsquid/sdk/node_modules/@cosmjs/tendermint-rpc';

export class Wallet {
    protected stargateClient: StargateClient | undefined;
    protected tendermintClient: Tendermint34Client | undefined;
    rpc: string;
    api: string;

    private constructor(rpc: string, api: string) { 
        this.rpc = rpc;
        this.api = api;
    }

    static async getInstance(rpc: string, api: string) {
        const wallet = new Wallet(rpc, api);
        await wallet.setInstance(rpc);
        return wallet;
    }

    private async setInstance(tendermintRpc: string) {
        const tendermintClient = await Tendermint34Client.connect(tendermintRpc);
        const stargateClient = await StargateClient.connect(tendermintRpc);
        this.stargateClient = stargateClient;
        this.tendermintClient = tendermintClient;
    }

    destroy() {
        if (this.stargateClient) {
            this.stargateClient?.disconnect();
        }
        if (this.tendermintClient) {
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

    public getTendermintClient() {
        return this.tendermintClient;
    }

    public getStargateClient() {
        return this.stargateClient;
    }
}
