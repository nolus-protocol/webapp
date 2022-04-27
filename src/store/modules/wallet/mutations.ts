import { MutationTree } from 'vuex'

import { AssetBalance, State } from './state'
import { WalletMutationTypes } from './mutation-types'
import { NolusWallet } from '@/wallet/NolusWallet'
import OpenLogin from '@toruslabs/openlogin'

export type Mutations<S = State> = {
  [WalletMutationTypes.SIGN_WALLET] (state: S, payload: { wallet: NolusWallet }): void,
  [WalletMutationTypes.TORUS_LOGIN] (state: S, payload: OpenLogin): void,
  [WalletMutationTypes.SET_PRIVATE_KEY] (state: S, payload: { privateKey: string }): void,
  [WalletMutationTypes.UPDATE_BALANCES] (state: S, payload: { balances: AssetBalance[] }): void
}

export const mutations: MutationTree<State> & Mutations = {
  [WalletMutationTypes.SIGN_WALLET] (state: State, payload: { wallet: NolusWallet }) {
    state.wallet = payload.wallet
  },
  [WalletMutationTypes.TORUS_LOGIN] (state: State, payload: OpenLogin) {
    state.torusClient = payload
  },
  [WalletMutationTypes.SET_PRIVATE_KEY] (state: State, payload: { privateKey: string }) {
    state.privateKey = payload.privateKey
  },
  [WalletMutationTypes.UPDATE_BALANCES] (state: State, payload: { balances: AssetBalance[] }) {
    state.balances = payload.balances
  }
}

//     signWallet (state, payload: { wallet: NolusWallet }) {
//       state.wallet = payload.wallet
//     },
//     torusLogin (state, payload: OpenLogin) {
//       state.torusClient = payload
//     },
//     setPrivateKey (state, payload: { privateKey: string }) {
//       state.privateKey = payload.privateKey
//     },
//     updateBalances (state, payload: { balances: [] }) {
//       state.balances = payload.balances
//     }
