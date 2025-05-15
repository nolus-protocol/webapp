import type { Coin } from "@cosmjs/proto-signing";
import { StargateClient } from "@cosmjs/stargate";
import { connectComet, type CometClient } from "@cosmjs/tendermint-rpc";
import { accountFromAny } from "./accountParser";

export class Wallet {
  protected stargateClient: StargateClient | undefined;
  protected tendermintClient: CometClient | undefined;
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
    const tendermintClient = await connectComet(tendermintRpc);
    const stargateClient = await StargateClient.create(tendermintClient, {
      accountParser: accountFromAny
    });
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

  public async getChainId(): Promise<string> {
    const client = this.stargateClient;
    const chainId = await client?.getChainId();
    if (!chainId) {
      throw new Error("Chain id is missing!");
    }
    return chainId;
  }

  public async getBalance(address: string, denom: string): Promise<Coin> {
    const client = this.stargateClient;
    const balance = client?.getBalance(address, denom);
    if (!balance) {
      throw new Error("Balance is missing!");
    }
    return await balance;
  }

  public async getBlockHeight(): Promise<number> {
    const client = this.stargateClient;
    const block = await client?.getBlock();
    if (!block?.header) {
      throw new Error("Block height is missing!");
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
