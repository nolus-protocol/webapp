import { GetterTree } from 'vuex'
import { RootState } from '@/store'
import { State } from './state'
import { NetworkConfig } from '@/config/env'

export type Getters = {
  getNetwork (state: State): NetworkConfig | null
}

export const getters: GetterTree<State, RootState> & Getters = {
  getNetwork: (state) => state.network
}
