import type { State } from "@/stores/application/state";

import { defineStore } from "pinia";
import { ApplicationActionTypes } from "@/stores/application/action-types";
import { EnvNetworkUtils, ThemeManager, WalletUtils } from "@/utils";
import { NolusClient } from "@nolus/nolusjs";
import { DEFAULT_PRIMARY_NETWORK } from "@/config/env";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { useOracleStore, OracleActionTypes } from "../oracle";

const useApplicationStore = defineStore("application", {
  state: () => {
    return {
      network: {},
      theme: null,
    } as State;
  },
  actions: {
    async [ApplicationActionTypes.CHANGE_NETWORK](loadBalance = false) {
      try {
        const loadedNetworkConfig = EnvNetworkUtils.loadNetworkConfig();

        if (!loadedNetworkConfig) {
          throw new Error("Please select different network");
        }

        NolusClient.setInstance(loadedNetworkConfig.tendermintRpc);
        const walletStore = useWalletStore();
        const oracle = useOracleStore();

        this.network.networkName =
          EnvNetworkUtils.getStoredNetworkName() || DEFAULT_PRIMARY_NETWORK;
        this.network.networkAddresses = loadedNetworkConfig;

        if (WalletUtils.isConnectedViaExtension()) {
          walletStore[WalletActionTypes.CONNECT_KEPLR]();
        }

        if (loadBalance) {
          await Promise.allSettled([
            walletStore[WalletActionTypes.UPDATE_BALANCES](),
            oracle[OracleActionTypes.GET_PRICES](),
          ]);
        }
      } catch (error: Error | any) {
        throw new Error(error);
      }
    },
    [ApplicationActionTypes.SET_THEME](theme: string) {
      try {
        ThemeManager.saveThemeData(theme);
        this.theme = theme;
      } catch (error: Error | any) {
        throw new Error(error);
      }
    },
    [ApplicationActionTypes.LOAD_THEME]() {
      try {
        const theme = ThemeManager.getThemeData();
        this.theme = theme;
      } catch (error: Error | any) {
        throw new Error(error);
      }
    },
  },
  getters: {},
});

export { useApplicationStore, ApplicationActionTypes };
