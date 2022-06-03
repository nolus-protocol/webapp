import { Coin } from '@keplr-wallet/unit'
import { NolusWallet } from '@nolus/nolusjs/build'

export interface AssetBalance {
  udenom: string,
  balance: Coin
}

export type State = {
  torusClient: object | null,
  wallet: NolusWallet | null
  privateKey: string,
  balances: AssetBalance[]
}

export const state: State = {
  torusClient: null,
  wallet: null,
  privateKey: '',
  balances: []
}
