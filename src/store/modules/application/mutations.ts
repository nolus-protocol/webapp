import { MutationTree } from 'vuex'

import { State } from './state'
import { ApplicationMutationTypes } from './mutation-types'
import { NetworkConfig } from '@/config/env'

export type Mutations<S = State> = {
  [ApplicationMutationTypes.APP_NETWORK] (state: S, payload: { network: NetworkConfig }): void,
}

export const mutations: MutationTree<State> & Mutations = {
  [ApplicationMutationTypes.APP_NETWORK] (state: State, payload: { network: NetworkConfig }) {
    state.network = payload.network
  }

}
