import type { State } from "@/stores/application/state";

import { defineStore } from "pinia";
import { ApplicationActionTypes } from "@/stores/application/action-types";
import { EnvNetworkUtils, ThemeManager, WalletUtils } from "@/utils";
import { NolusClient } from "@nolus/nolusjs";
import { DEFAULT_PRIMARY_NETWORK, NETWORKS } from "@/config/env";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { useOracleStore, OracleActionTypes } from "../oracle";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { CONTRACTS } from "@/config/contracts";
import { Dec } from "@keplr-wallet/unit";

const useApplicationStore = defineStore("application", {
  state: () => {
    return {
      network: {},
      theme: null,
      apr: null
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
    async [ApplicationActionTypes.LOAD_APR]() {

      try {
        const url = NETWORKS[EnvNetworkUtils.getStoredNetworkName()].tendermintRpc;
        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const lppClient = new Lpp(cosmWasmClient, CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance);

        const [genesis, status, price] = await Promise.all([
          fetch(
            `${url}/genesis`
          ).then((data) => data.json()),
          fetch(
            `${url}/status`
          ).then((data) => data.json()),
          lppClient.getPrice()
        ]);

        const currentDate  =  new Date(status.result.sync_info.latest_block_time);
        const startDate = new Date(genesis.result.genesis.genesis_time);
        const time = currentDate.getTime() - startDate.getTime();
        const timeInDays = new Dec(Math.round(time / 24 / 60 / 60 / 1000));
        const p = new Dec(price.amount_quote.amount).quo(new Dec((price.amount.amount))).quo(new Dec(1)).sub(new Dec(1)).quo(timeInDays).mul(new Dec(365));
        this.apr = Number(p.toString()) * 100;
  
      } catch (error) {
        console.log(error)
      }

    },
  },
  getters: {},
});

export { useApplicationStore, ApplicationActionTypes };
