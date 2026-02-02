import type { Store } from "../types";
import { DEFAULT_PRIMARY_NETWORK, NETWORKS } from "@/config/global";
import { EnvNetworkUtils, WalletManager } from "@/common/utils";
import { fetchEndpoints } from "@/common/utils/EndpointService";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { usePricesStore } from "@/common/stores/prices";
import { useConfigStore } from "@/common/stores/config";
import { useWalletStore } from "../../wallet";

export async function changeNetwork(this: Store) {
  try {
    const rpc = (await fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;
    NolusClient.setInstance(rpc);
    const configStore = useConfigStore();

    this.protocolFilter = WalletManager.getProtocolFilter();
    this.network.networkName = EnvNetworkUtils.getStoredNetworkName() || DEFAULT_PRIMARY_NETWORK;
    this.network.networkAddresses = {
      ...NETWORKS[this.network.networkName]
    };

    await configStore.fetchConfig();
    await this.LOAD_CURRENCIES();

    loadWalletData.bind(this)();
  } catch (error: Error | any) {
    throw new Error(error);
  }
}

async function loadWalletData(this: Store) {
  try {
    const walletStore = useWalletStore();
    const pricesStore = usePricesStore();

    await Promise.allSettled([
      walletStore.UPDATE_BALANCES(),
      pricesStore.fetchPrices(),
      this.LOAD_APR_REWARDS(),
      walletStore.LOAD_APR()
    ]);
    this.init = true;
  } catch (error: Error | any) {
    throw new Error(error);
  }
}
