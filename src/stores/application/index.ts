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
    [ApplicationActionTypes.CHANGE_NETWORK]() {
      try {
        const loadedNetworkConfig = EnvNetworkUtils.loadNetworkConfig();
        if (!loadedNetworkConfig) {
          throw new Error('Please select different network');
        }
        NolusClient.setInstance(loadedNetworkConfig.tendermintRpc);
        this.network.networkName = EnvNetworkUtils.getStoredNetworkName() || DEFAULT_PRIMARY_NETWORK;
        this.network.networkAddresses = loadedNetworkConfig;

        if (WalletUtils.isConnectedViaExtension()) {
          const walletStore = useWalletStore();
          walletStore[WalletActionTypes.CONNECT_KEPLR]();
        }

      } catch (error: Error | any) {
        throw new Error(error);
      }
    },
  },
  getters: {},
});

export { useApplicationStore, ApplicationActionTypes };
