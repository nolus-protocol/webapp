import { ActionContext, ActionTree } from 'vuex'
import { RootState } from '@/store'

import { State } from './state'
import { Mutations } from './mutations'
import { Getters } from '@/store/modules/wallet/getters'
import { ApplicationActionTypes } from '@/store/modules/application/action-types'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import { ApplicationMutationTypes } from '@/store/modules/application/mutation-types'
import { DEFAULT_PRIMARY_NETWORK } from '@/config/env'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { NolusClient } from '@nolus/nolusjs/build'
import { WalletUtils } from '@/utils/WalletUtils'
import { NetworkConfig } from '@/types/NetworkConfig'

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
    try {
      const loadedNetworkConfig = EnvNetworkUtils.loadNetworkConfig()
      if (!loadedNetworkConfig) {
        throw new Error('Please select different network')
      }
      NolusClient.setInstance(loadedNetworkConfig.tendermintRpc)
      commit(ApplicationMutationTypes.APP_NETWORK, {
        network: {
          networkName: EnvNetworkUtils.getStoredNetworkName() || DEFAULT_PRIMARY_NETWORK,
          networkAddresses: loadedNetworkConfig
        } as NetworkConfig
      })

      if (WalletUtils.isConnectedViaExtension()) {
        dispatch(WalletActionTypes.CONNECT_KEPLR)
      }
    } catch (e: any) {
      throw new Error(e)
    }
  }
}
