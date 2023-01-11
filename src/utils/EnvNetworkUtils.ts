import type { NetworkAddress } from "@/types";
import { DEFAULT_PRIMARY_NETWORK, NETWORKS } from "@/config/env";

export class EnvNetworkUtils {
  public static saveCurrentNetwork(networkName: string) {
    localStorage.setItem("currentNetwork", networkName);
  }

  public static removeCurrentNetwork() {
    localStorage.removeItem("currentNetwork");
  }

  public static getEnvNetworks(): string[] {
    const envNetworks = import.meta.env.VITE_APP_NETWORKS;
    if (envNetworks) {
      return envNetworks.split(" ");
    }

    return [];
  }

  public static loadNetworkConfig(): NetworkAddress | null {
    if (
      !this.getStoredNetworkName() ||
      !NETWORKS[this.getStoredNetworkName() as string]
    ) {
      EnvNetworkUtils.saveCurrentNetwork(DEFAULT_PRIMARY_NETWORK);
      return NETWORKS[DEFAULT_PRIMARY_NETWORK];
    }

    return NETWORKS[this.getStoredNetworkName() as string];
  }

  public static getStoredNetworkName(): string {
    return localStorage.getItem("currentNetwork") || DEFAULT_PRIMARY_NETWORK;
  }
}
