import { ActionContext, ActionTree } from 'vuex'
import { RootState } from '@/store'

import { Price, State } from './state'
import { Mutations } from './mutations'
import { Getters } from '@/store/modules/wallet/getters'
import { OracleActionTypes } from '@/store/modules/oracle/action-types'
import { OracleMutationTypes } from '@/store/modules/oracle/mutation-types'
import { Oracle, Prices } from '@nolus/nolusjs/build/contracts'
import { CONTRACTS } from '@/config/contracts'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import { NolusClient } from '@nolus/nolusjs'
import { Dec } from '@keplr-wallet/unit'
import { oracleDenoms } from '@/config/currencies'

type AugmentedActionContext = {
  commit<K extends keyof Mutations> (
    key: K,
    payload: Parameters<Mutations[K]>[1],
  ): ReturnType<Mutations[K]>
  getters<K extends keyof Getters> (
    key: K,
    payload: Parameters<Getters[K]>[1],
  ): ReturnType<Getters[K]>
} & Omit<ActionContext<State, RootState>, 'commit'>

export interface Actions {
  [OracleActionTypes.GET_PRICES] ({ commit }: AugmentedActionContext): void,
}

export const actions: ActionTree<State, RootState> & Actions = {
  async [OracleActionTypes.GET_PRICES] ({ commit }) {
    try {
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
      const oracleContract = new Oracle(cosmWasmClient, CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].oracle.instance)
      const oraclePrices: Prices = await oracleContract.getPricesFor(oracleDenoms)
      const pricesState: { [key: string]: Price } = {}

      oraclePrices.prices.forEach(price => {
        const calculatedPrice: Dec = new Dec(price.base.amount).quo(new Dec(price.quote.amount))
        const tokenPrice: Price = {
          amount: calculatedPrice.toString(),
          symbol: price.quote.symbol
        }
        pricesState[price.base.symbol] = tokenPrice
      })

      commit(OracleMutationTypes.CHANGE_PRICES, { prices: pricesState })
    } catch (e: any) {
      throw new Error(e)
    }
  }
}
