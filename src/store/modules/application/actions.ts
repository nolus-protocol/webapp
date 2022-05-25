import { ActionContext, ActionTree } from 'vuex'
import { RootState } from '@/store'

import { State } from './state'
import { Mutations } from './mutations'
import { Getters } from '@/store/modules/wallet/getters'
import { ApplicationActionTypes } from '@/store/modules/application/action-types'
import { NolusClient } from '@/client/NolusClient'
import { EnvNetworks } from '@/config/envNetworks'
import { ApplicationMutationTypes } from '@/store/modules/application/mutation-types'
import { DEFAULT_PRIMARY_NETWORK, NetworkConfig } from '@/config/env.config'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'

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
  [ApplicationActionTypes.CHANGE_NETWORK] ({
    commit,
    dispatch
  }: AugmentedActionContext): void,
}

export const actions: ActionTree<State, RootState> & Actions = {
  [ApplicationActionTypes.CHANGE_NETWORK] ({
    commit,
    dispatch
  }) {
    const envNetworks = new EnvNetworks()
    const loadedNetworkConfig = envNetworks.loadNetworkConfig()
    if (!loadedNetworkConfig) {
      throw new Error('Please select different network')
    }
    NolusClient.setInstance(loadedNetworkConfig.tendermintRpc)
    commit(ApplicationMutationTypes.APP_NETWORK, {
      network: {
        networkName: envNetworks.getStoredNetworkName() || DEFAULT_PRIMARY_NETWORK,
        networkAddresses: loadedNetworkConfig
      } as NetworkConfig
    })

    dispatch(WalletActionTypes.CONNECT_KEPLR)
  }
}
