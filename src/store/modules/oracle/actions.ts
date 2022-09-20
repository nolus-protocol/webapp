import { ActionContext, ActionTree } from 'vuex'
import { RootState } from '@/store'

import { Price, State } from './state'
import { Mutations } from './mutations'
import { Getters } from '@/store/modules/wallet/getters'
import { OracleActionTypes } from '@/store/modules/oracle/action-types'
import { OracleMutationTypes } from '@/store/modules/oracle/mutation-types'
import { Oracle } from '@nolus/nolusjs/build/contracts'
import { CONTRACTS } from '@/config/contracts'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import { NolusClient } from '@nolus/nolusjs'

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
    const pricesResponse = {
      prices: [
        {
          denom: 'OSMO',
          price: {
            amount: '1.5',
            denom: 'B'
          }
        },
        {
          denom: 'NLS',
          price: {
            amount: '1.5',
            denom: 'B'
          }
        },
        {
          denom: 'ATOM',
          price: {
            amount: '1.4',
            denom: 'B'
          }
        },
        {
          denom: 'LUM',
          price: {
            amount: '1.1',
            denom: 'B'
          }
        },
        {
          denom: 'USDC',
          price: {
            amount: '1.1',
            denom: 'B'
          }
        }
      ]
    }
    const pricesState: { [key: string]: Price } = {}
    pricesResponse.prices.forEach(e => {
      pricesState[e.denom.toLowerCase()] = e.price
    })

    // const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
    // const oracleContract = new Oracle(cosmWasmClient, CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].oracle.instance)
    // const oraclePrices = await oracleContract.getPricesFor(['unls', 'uusdc'])

    commit(OracleMutationTypes.CHANGE_PRICES, { prices: pricesState })
  }
}
