import { Tendermint34Client } from '@cosmjs/tendermint-rpc'
import { CosmWasmClient, cosmWasmTypes } from '@cosmjs/cosmwasm-stargate'
import { Coin } from '@cosmjs/proto-signing'

export class NolusClient {
  private static instance: NolusClient | null = null
  protected cosmWasmClient: Promise<CosmWasmClient> | undefined
  protected tmClient: Promise<Tendermint34Client> | undefined

  private constructor (tendermintRpc: string) {
    this.cosmWasmClient = CosmWasmClient.connect(tendermintRpc)
    this.tmClient = Tendermint34Client.connect(tendermintRpc)
  }

  static getInstance () {
    if (this.instance === null) {
      throw new Error('Set the Tendermint RPC address before getting instance')
    }
    return this.instance
  }

  static setInstance (tendermintRpc: string) {
    this.instance = new NolusClient(tendermintRpc)
  }

  public async getCosmWasmClient (): Promise<CosmWasmClient> {
    const client = await this.cosmWasmClient
    if (!client) {
      throw new Error('Missing CosmWasm client')
    }
    return client
  }

  public async getTendermintClient (): Promise<Tendermint34Client> {
    const client = await this.tmClient
    if (!client) {
      throw new Error('Missing Tendermint client')
    }
    return client
  }

  public getChainId = async (): Promise<string> => {
    const client = await this.cosmWasmClient
    const chainId = await client?.getChainId()
    if (!chainId) {
      throw new Error('Chain ID is missing!')
    }
    return chainId
  }

  public async getBalance (address: string, denom: string): Promise<Coin> {
    const client = await this.cosmWasmClient
    const balance = client?.getBalance(address, denom)
    if (!balance) {
      throw new Error('Balance is missing!')
    }
    return balance
  }

  public async getBlockHeight (): Promise<number> {
    const client = await this.cosmWasmClient
    const block = await client?.getBlock()
    if (!block?.header) {
      throw new Error('Block height is missing!')
    }
    return block?.header.height
  }
}
