import { DEFAULT_PRIMARY_NETWORK, NETWORKS } from '../config/env'
import { NetworkAddress } from '@/types/NetworkAddress'

export class EnvNetworkUtils {
  public static saveCurrentNetwork (networkName: string) {
    localStorage.setItem('currentNetwork', networkName)
  }

  public static removeCurrentNetwork () {
    localStorage.removeItem('currentNetwork')
  }

  public getEnvNetworks (): string[] {
    const envNetworks = process.env.VUE_APP_NETWORKS
    if (envNetworks) {
      return envNetworks.split(' ')
    }

    return []
  }

  public loadNetworkConfig (): NetworkAddress | null {
    if (!this.getStoredNetworkName() || !NETWORKS[this.getStoredNetworkName() as string]) {
      EnvNetworkUtils.saveCurrentNetwork(DEFAULT_PRIMARY_NETWORK)
      return NETWORKS[DEFAULT_PRIMARY_NETWORK]
    }

    return NETWORKS[this.getStoredNetworkName() as string]
  }

  public getStoredNetworkName (): string | null {
    return localStorage.getItem('currentNetwork')
  }
}
