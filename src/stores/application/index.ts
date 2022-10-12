import type { State } from '@/stores/application/state';

import { defineStore } from 'pinia';
import { ApplicationActionTypes } from '@/stores/application/action-types';
import { EnvNetworkUtils, WalletUtils } from '@/utils';
import { NolusClient } from '@nolus/nolusjs';
import { DEFAULT_PRIMARY_NETWORK } from '@/config/env';
import { useWalletStore, WalletActionTypes } from '@/stores/wallet';

const useApplicationStore = defineStore('application', {
  state: () => {
    return {
      network: {},
    } as State;
  },
  actions: {
    async [ApplicationActionTypes.CHANGE_NETWORK](loadBalance = false) {
      try {
        const loadedNetworkConfig = EnvNetworkUtils.loadNetworkConfig();
        
        if (!loadedNetworkConfig) {
          throw new Error('Please select different network');
        }

        NolusClient.setInstance(loadedNetworkConfig.tendermintRpc);
        const walletStore = useWalletStore();
        this.network.networkName = EnvNetworkUtils.getStoredNetworkName() || DEFAULT_PRIMARY_NETWORK;
        this.network.networkAddresses = loadedNetworkConfig;
        
        if (WalletUtils.isConnectedViaExtension()) {
          walletStore[WalletActionTypes.CONNECT_KEPLR]();
        }

        if(loadBalance){
          await walletStore[WalletActionTypes.UPDATE_BALANCES]();
        }


      } catch (error: Error | any) {
        throw new Error(error);
      }
    },
  },
  getters: {},
});

export { useApplicationStore, ApplicationActionTypes };
