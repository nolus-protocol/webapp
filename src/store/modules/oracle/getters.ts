import { GetterTree } from 'vuex'
import { RootState } from '@/store'
import { Price, State } from './state'

export type Getters = {
  getPrices (state: State): { [key: string]: Price } | null
}

export const getters: GetterTree<State, RootState> & Getters = {
  getPrices: (state) => state.prices
}
