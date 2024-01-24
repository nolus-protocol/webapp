import type { State } from "@/stores/application/state";

import { defineStore } from "pinia";
import { ApplicationActionTypes } from "@/stores/application/action-types";
import { AssetUtils, EnvNetworkUtils, ThemeManager, WalletManager } from "@/utils";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { DEFAULT_PRIMARY_NETWORK, INTEREST_DECIMALS, NATIVE_NETWORK, NETWORKS } from "@/config/env";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { useOracleStore, OracleActionTypes } from "../oracle";
import { Disparcher } from "@nolus/nolusjs/build/contracts";
import { CONTRACTS } from "@/config/contracts";
import { AppUtils } from "@/utils/AppUtils";
import { WalletConnectMechanism } from "@/types";
import { Protocols } from "@nolus/nolusjs/build/types/Networks";
import { AssetUtils as NolusAssetUtils } from "@nolus/nolusjs/build/utils/AssetUtils";
import { EtlApi } from "@/utils/EtlApi";
import { useAdminStore } from "../admin";

const useApplicationStore = defineStore("application", {
  state: () => {
    return {
      networks: null,
      networksData: null,
      assetIcons: null,
      network: {},
      theme: null,
      apr: null,
      dispatcherRewards: null,
      lpn: null,
      native: null,
      lease: null,
      currenciesData: null,
      sessionExpired: false,
      protocols: [] as string[],
      leasesCurrencies: [] as string[]
    } as State;
  },
  actions: {
    async [ApplicationActionTypes.LOAD_CURRENCIES]() {

      try {
        const network = NETWORKS[EnvNetworkUtils.getStoredNetworkName()];
        const currenciesData = await network.currencies();
        const data = AssetUtils.parseNetworks(currenciesData);
        const lease: { [key: string]: string[] } = {};
        const leasesCurrencies = new Set<string>()

        this.assetIcons = data.assetIcons;
        this.networks = data.networks;
        this.networksData = currenciesData;

        const native = NolusAssetUtils.getNativeAsset(currenciesData);
        this.protocols = NolusAssetUtils.getProtocols(this.networksData!);

        this.lpn = [];
        const nativeCurrency = currenciesData.networks.list[NATIVE_NETWORK.key].currencies[native].native;
        this.native = {
          name: nativeCurrency.name,
          shortName: nativeCurrency.ticker,
          symbol: nativeCurrency.symbol,
          decimal_digits: nativeCurrency.decimal_digits,
          ticker: nativeCurrency.ticker,
          native: true,
          key: nativeCurrency.ticker,
          ibcData: nativeCurrency.symbol
        };

        for (const protocol of this.protocols) {
          const lpn = NolusAssetUtils.getLpn(currenciesData, protocol);
          this.lpn.push(
            data.networks[NATIVE_NETWORK.key][`${lpn}@${protocol}`],
          )
        }

        this.currenciesData = data.networks[NATIVE_NETWORK.key];

        for (const protocol of this.protocols) {
          lease[protocol] = [];
          for (const l of NolusAssetUtils.getLease(currenciesData, protocol as Protocols)) {
            lease[protocol].push(l);
            leasesCurrencies.add(l)
          }
        }
        this.lease = lease;
        this.leasesCurrencies = Array.from(leasesCurrencies)
      } catch (e) {
        console.log(e)
      }

    },
    async [ApplicationActionTypes.CHANGE_NETWORK](loadBalance = false) {
      try {
        const rpc = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;
        NolusClient.setInstance(rpc);
        const walletStore = useWalletStore();
        const oracle = useOracleStore();

        this.network.networkName = EnvNetworkUtils.getStoredNetworkName() || DEFAULT_PRIMARY_NETWORK;
        this.network.networkAddresses = {
          ...NETWORKS[this.network.networkName]
        };

        switch (WalletManager.getWalletConnectMechanism()) {
          case WalletConnectMechanism.EXTENSION: {
            walletStore[WalletActionTypes.CONNECT_KEPLR]();
            break;
          }
          case WalletConnectMechanism.LEAP: {
            walletStore[WalletActionTypes.CONNECT_LEAP]();
            break;
          }
          case WalletConnectMechanism.LEDGER: {
            walletStore[WalletActionTypes.CONNECT_LEDGER]();
            break;
          }
          case WalletConnectMechanism.LEDGER_BLUETOOTH: {
            walletStore[WalletActionTypes.CONNECT_LEDGER]();
            break;
          }
          default: {
            break;
          }
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
    async [ApplicationActionTypes.LOAD_APR_REWARDS]() {

      try {

        const admin = useAdminStore();
        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const dispatcherClient = new Disparcher(cosmWasmClient, CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].dispatcher.instance);

        const apr: { [key: string]: number } = {};
        const promises = [
          dispatcherClient.calculateRewards().catch(() => 130)
        ];

        for (const protocolKey in admin.contracts) {
          const fn = async () => {
            const data = await EtlApi.fetchEarnApr(protocolKey);
            apr[protocolKey] = data.earn_apr;
          }
          promises.push(fn());
        }

        const [dispatcherRewards] = await Promise.all(promises);
        this.apr = apr;
        this.dispatcherRewards = dispatcherRewards / Math.pow(10, INTEREST_DECIMALS);

      } catch (error) {
        console.log(error)
      }

    },
  },
  getters: {
    getCurrencySymbol: (state) => {
      return (ticker: string, protocol?: string) => {
        const c = state.currenciesData?.[`${ticker}@${protocol}`];

        if (c) {
          return c;
        }

        for (const key in state.currenciesData) {
          const currency = state.currenciesData[key];
          if (ticker == currency.ticker) {
            return currency;
          }
        }
      }
    },
  },
});

export { useApplicationStore, ApplicationActionTypes };
