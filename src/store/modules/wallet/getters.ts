import { GetterTree } from 'vuex'
import { RootState } from '@/store'
import { AssetBalance, State } from './state'
import { NolusWallet } from '@nolus/nolusjs'

export type Getters = {
  getBalances (state: State): AssetBalance[]
  getNolusWallet (state: State): NolusWallet | null
  getPrivateKey (state: State): string
  getTorusWallet (state: State): object | null
}

export const getters: GetterTree<State, RootState> & Getters = {
  getBalances: (state) => state.balances,
  getNolusWallet: (state) => state.wallet,
  getPrivateKey: (state) => state.privateKey,
  getTorusWallet: (state) => state.torusClient
}
