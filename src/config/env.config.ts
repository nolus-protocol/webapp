export interface NetworkConfig {
    networkName: string,
    networkAddresses: NetworkAddress
}

export interface NetworkAddress {
    'tendermintRpc': string,
    'api': string
}

export const DEFAULT_PRIMARY_NETWORK = 'devnet'

export const NETWORKS: { [key: string]: NetworkAddress; } = {
  localnet: {
    tendermintRpc: 'http://127.0.0.1:26657',
    api: 'http://127.0.0.1:1317'
  },
  devnet: {
    tendermintRpc: 'https://net-dev.nolus.io:26612',
    api: 'https://net-dev.nolus.io:26614'
  }
}
