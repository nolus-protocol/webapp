import type { OfflineSigner } from '@0xsquid/sdk/node_modules/@cosmjs/proto-signing';
import type { Tendermint34Client } from '@0xsquid/sdk/node_modules/@cosmjs/tendermint-rpc';

import { SigningCosmWasmClient, type SigningCosmWasmClientOptions } from '@0xsquid/sdk/node_modules/@cosmjs/cosmwasm-stargate';

export class BaseWallet extends SigningCosmWasmClient {
    address?: string;
    pubKey?: Uint8Array;
    algo?: string;
    rpc: string;
    api: string;
    prefix: string;

    protected offlineSigner: OfflineSigner;

    constructor(tmClient: Tendermint34Client | undefined, signer: OfflineSigner, options: SigningCosmWasmClientOptions, rpc: string, api: string, prefix: string) {
        super(tmClient, signer, options);
        this.offlineSigner = signer;
        this.rpc = rpc;
        this.api = api;
        this.prefix = prefix;
    }

    getOfflineSigner(){
        return this.offlineSigner;
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

}