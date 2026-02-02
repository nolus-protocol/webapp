import type { Networks } from "@/common/types";
import { CURRENT_NETWORK_KEY, DEFAULT_PRIMARY_NETWORK } from "@/config/global";

export class EnvNetworkUtils {
  public static saveCurrentNetwork(networkName: string) {
    localStorage.setItem(CURRENT_NETWORK_KEY, networkName);
  }

  public static removeCurrentNetwork() {
    localStorage.removeItem(CURRENT_NETWORK_KEY);
  }

  public static getStoredNetworkName(): Networks {
    return (localStorage.getItem(CURRENT_NETWORK_KEY) || DEFAULT_PRIMARY_NETWORK) as Networks;
  }
}
