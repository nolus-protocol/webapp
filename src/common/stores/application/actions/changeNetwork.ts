import type { Store } from "../types";
import { DEFAULT_PRIMARY_NETWORK, NETWORKS } from "@/config/global";
import { AppUtils, EnvNetworkUtils } from "@/common/utils";
import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { useOracleStore } from "@/common/stores/oracle";
import { useWalletStore } from "../../wallet";
import { useAdminStore } from "../../admin";

export async function changeNetwork(this: Store) {
  try {
    const rpc = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;
    NolusClient.setInstance(rpc);

    const walletStore = useWalletStore();
    const oracle = useOracleStore();
    const admin = useAdminStore();

    this.network.networkName = EnvNetworkUtils.getStoredNetworkName() || DEFAULT_PRIMARY_NETWORK;
    this.network.networkAddresses = {
      ...NETWORKS[this.network.networkName]
    };

    await Promise.all([this.LOAD_CURRENCIES(), admin.GET_PROTOCOLS()]);
    await Promise.allSettled([walletStore.UPDATE_BALANCES(), oracle.GET_PRICES(), this.LOAD_APR_REWARDS()]);
  } catch (error: Error | any) {
    throw new Error(error);
  }
}
