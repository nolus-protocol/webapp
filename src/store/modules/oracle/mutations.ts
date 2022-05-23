import { MutationTree } from 'vuex'

import { Price, State } from './state'
import { OracleMutationTypes } from '@/store/modules/oracle/mutation-types'

export type Mutations<S = State> = {
  [OracleMutationTypes.CHANGE_PRICES] (state: S, payload: { prices: { [key: string]: Price } }): void,
}

export const mutations: MutationTree<State> & Mutations = {
  [OracleMutationTypes.CHANGE_PRICES] (state: State, payload: { prices: { [key: string]: Price } }) {
    state.prices = payload.prices
  }
}
