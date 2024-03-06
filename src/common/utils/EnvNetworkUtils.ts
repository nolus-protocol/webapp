import type { NetworkAddress, Networks } from "@/common/types";
import { DEFAULT_PRIMARY_NETWORK, NETWORKS } from "@/config/global";

export class EnvNetworkUtils {
  public static CURRENT_NETWORK = "currentNetwork";

  public static saveCurrentNetwork(networkName: string) {
    localStorage.setItem(EnvNetworkUtils.CURRENT_NETWORK, networkName);
  }

  public static removeCurrentNetwork() {
    localStorage.removeItem(EnvNetworkUtils.CURRENT_NETWORK);
  }

  public static getEnvNetworks(): string[] {
    const envNetworks = import.meta.env.VITE_APP_NETWORKS;
    if (envNetworks) {
      return envNetworks.split(" ");
    }

    return [];
  }

  public static loadNetworkConfig(): NetworkAddress | null {
    if (!this.getStoredNetworkName() || !NETWORKS[this.getStoredNetworkName() as string]) {
      EnvNetworkUtils.saveCurrentNetwork(DEFAULT_PRIMARY_NETWORK);
      return NETWORKS[DEFAULT_PRIMARY_NETWORK];
    }

    return NETWORKS[this.getStoredNetworkName() as string];
  }

  public static getStoredNetworkName(): Networks {
    return (localStorage.getItem(EnvNetworkUtils.CURRENT_NETWORK) || DEFAULT_PRIMARY_NETWORK) as Networks;
  }
}
