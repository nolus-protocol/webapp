import { ChainInfo } from '@keplr-wallet/types'
import { ChainConstants } from '@nolus/nolusjs'

const KeplrEmbedChainInfo = (networkName: string, chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: ChainConstants.CHAIN_NAME + '-' + networkName,
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: ChainConstants.COIN_TYPE
    },
    bech32Config: {
      bech32PrefixAccAddr: ChainConstants.BECH32_PREFIX_ACC_ADDR,
      bech32PrefixAccPub: ChainConstants.BECH32_PREFIX_ACC_PUB,
      bech32PrefixValAddr: ChainConstants.BECH32_PREFIX_VAL_ADDR,
      bech32PrefixValPub: ChainConstants.BECH32_PREFIX_VAL_PUB,
      bech32PrefixConsAddr: ChainConstants.BECH32_PREFIX_CONS_ADDR,
      bech32PrefixConsPub: ChainConstants.BECH32_PREFIX_CONS_PUB
    },
    currencies: [
      {
        coinDenom: ChainConstants.COIN_DENOM,
        coinMinimalDenom: ChainConstants.COIN_MINIMAL_DENOM,
        coinDecimals: ChainConstants.COIN_DECIMALS,
        coinGeckoId: ChainConstants.COIN_GECKO_ID
      }
    ],
    feeCurrencies: [
      {
        coinDenom: ChainConstants.COIN_DENOM,
        coinMinimalDenom: ChainConstants.COIN_MINIMAL_DENOM,
        coinDecimals: ChainConstants.COIN_DECIMALS,
        coinGeckoId: ChainConstants.COIN_GECKO_ID
      }
    ],
    stakeCurrency: {
      coinDenom: ChainConstants.COIN_DENOM,
      coinMinimalDenom: ChainConstants.COIN_MINIMAL_DENOM,
      coinDecimals: ChainConstants.COIN_DECIMALS,
      coinGeckoId: ChainConstants.COIN_GECKO_ID
    },
    coinType: ChainConstants.COIN_TYPE,
    gasPriceStep: {
      low: 0.01,
      average: 0.025,
      high: 0.03
    },
    features: ['ibc-transfer']
  }
}

export const IBCAssets: {
  sourceChannelId: string,
  coinMinimalDenom: string
}[] = [
  {
    sourceChannelId: 'channel-88',
    coinMinimalDenom: 'uscrt'
  },
  {
    sourceChannelId: 'channel-72',
    coinMinimalDenom: 'uluna'
  },
  {
    sourceChannelId: 'channel-115',
    coinMinimalDenom: 'ulum'
  }
]

export enum WalletConnectMechanism {
  EXTENSION = 'extension',
  LEDGER = 'ledger',
  MNEMONIC = 'mnemonic',
  TORUS = 'torus',
}

export class WalletManager {
  public static WALLET_SECURE_DATA = 'wallet-secure-data'
  public static WALLET_SECURE_KEY = 'wallet-secure-key'
  public static WALLET_CONNECT_MECHANISM = 'wallet_connect_mechanism'
  public static WALLET_ADDRESS = 'wallet_address'

  public static saveWalletConnectMechanism (walletConnectMechanism: WalletConnectMechanism) {
    localStorage.setItem(this.WALLET_CONNECT_MECHANISM, walletConnectMechanism)
  }

  public static getWalletConnectMechanism (): string | null {
    return localStorage.getItem(this.WALLET_CONNECT_MECHANISM)
  }

  public static removeWalletConnectMechanism () {
    localStorage.removeItem(this.WALLET_CONNECT_MECHANISM)
  }

  public static storeEncryptedPubKey (pubKey: string) {
    localStorage.setItem(this.WALLET_SECURE_KEY, pubKey)
  }

  public static getEncryptedPubKey (): string {
    const pubkey = localStorage.getItem(this.WALLET_SECURE_KEY)
    if (!pubkey) {
      throw new Error('Missing encrypted key')
    }
    return pubkey
  }

  public static removeEncryptedPubKey () {
    localStorage.removeItem(this.WALLET_SECURE_KEY)
  }

  public static storeEncryptedPk (encryptedPk: string) {
    localStorage.setItem(this.WALLET_SECURE_DATA, encryptedPk)
  }

  public static getPrivateKey (): string {
    const pvKey = localStorage.getItem(this.WALLET_SECURE_DATA)
    if (!pvKey) {
      throw new Error('Missing encrypted private key')
    }
    return pvKey
  }

  public static removePrivateKey () {
    localStorage.removeItem(this.WALLET_SECURE_DATA)
  }

  public static storeWalletAddress (address: string) {
    localStorage.setItem(this.WALLET_ADDRESS, address)
  }

  public static getWalletAddress (): string {
    return localStorage.getItem(this.WALLET_ADDRESS) || ''
  }

  public static removeWalletAddress () {
    localStorage.removeItem(this.WALLET_ADDRESS)
  }

  public static eraseWalletInfo () {
    localStorage.removeItem(this.WALLET_ADDRESS)
    localStorage.removeItem(this.WALLET_SECURE_DATA)
    localStorage.removeItem(this.WALLET_SECURE_KEY)
    localStorage.removeItem(this.WALLET_CONNECT_MECHANISM)
  }
}

export default KeplrEmbedChainInfo
