import { SigningCosmWasmClient, SigningCosmWasmClientOptions } from '@cosmjs/cosmwasm-stargate'
import { OfflineSigner } from '@cosmjs/proto-signing'
import { Tendermint34Client } from '@cosmjs/tendermint-rpc'

export class NolusWallet extends SigningCosmWasmClient {
  address?: string
  pubKey?: Uint8Array
  algo?: string

  protected offlineSigner: OfflineSigner;

  constructor (tmClient: Tendermint34Client | undefined, signer: OfflineSigner, options: SigningCosmWasmClientOptions) {
    super(tmClient, signer, options)
    this.offlineSigner = signer
  }

  public async useAccount (): Promise<boolean> {
    const accounts = await this.offlineSigner.getAccounts()
    if (accounts.length === 0) {
      throw new Error('Missing account')
    }

    this.address = accounts[0].address
    this.pubKey = accounts[0].pubkey
    this.algo = accounts[0].algo

    return true
  }
}
