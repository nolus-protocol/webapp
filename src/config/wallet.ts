import { ChainInfo } from '@keplr-wallet/types'
import {
  BECH32_PREFIX_ACC_ADDR,
  BECH32_PREFIX_ACC_PUB,
  BECH32_PREFIX_CONS_ADDR,
  BECH32_PREFIX_CONS_PUB,
  BECH32_PREFIX_VAL_ADDR,
  BECH32_PREFIX_VAL_PUB,
  CHAIN_NAME,
  COIN_DECIMALS,
  COIN_DENOM,
  COIN_GECKO_ID,
  COIN_MINIMAL_DENOM,
  COIN_TYPE
} from '../constants/chain'

const KeplrEmbedChainInfo = (networkName: string, chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: CHAIN_NAME + '-' + networkName,
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: COIN_TYPE
    },
    bech32Config: {
      bech32PrefixAccAddr: BECH32_PREFIX_ACC_ADDR,
      bech32PrefixAccPub: BECH32_PREFIX_ACC_PUB,
      bech32PrefixValAddr: BECH32_PREFIX_VAL_ADDR,
      bech32PrefixValPub: BECH32_PREFIX_VAL_PUB,
      bech32PrefixConsAddr: BECH32_PREFIX_CONS_ADDR,
      bech32PrefixConsPub: BECH32_PREFIX_CONS_PUB
    },
    currencies: [
      {
        coinDenom: COIN_DENOM,
        coinMinimalDenom: COIN_MINIMAL_DENOM,
        coinDecimals: COIN_DECIMALS,
        coinGeckoId: COIN_GECKO_ID
      }
    ],
    feeCurrencies: [
      {
        coinDenom: COIN_DENOM,
        coinMinimalDenom: COIN_MINIMAL_DENOM,
        coinDecimals: COIN_DECIMALS,
        coinGeckoId: COIN_GECKO_ID
      }
    ],
    stakeCurrency: {
      coinDenom: COIN_DENOM,
      coinMinimalDenom: COIN_MINIMAL_DENOM,
      coinDecimals: COIN_DECIMALS,
      coinGeckoId: COIN_GECKO_ID
    },
    coinType: COIN_TYPE,
    gasPriceStep: {
      low: 0.01,
      average: 0.025,
      high: 0.03
    },
    features: ['stargate', 'ibc-transfer', 'no-legacy-stdTx']
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
  public static saveWalletConnectMechanism (walletConnectMechanism: WalletConnectMechanism) {
    localStorage.setItem('wallet_connect_mechanism', walletConnectMechanism)
  }

  public static getWalletConnectMechanism (): string | null {
    return localStorage.getItem('wallet_connect_mechanism')
  }

  public static removeWalletConnectMechanism () {
    localStorage.removeItem('wallet_connect_mechanism')
  }

  private static encryptPubKey (pubKey: string) {

  }

  public static storeEncryptedPk (encryptedPk: string) {
    localStorage.setItem('secure-storage', encryptedPk)
  }

  public static getPrivateKey (): string | null {
    return localStorage.getItem('secure-storage')
  }

  public static removePrivateKey () {
    localStorage.removeItem('secure-storage')
  }
}

export default KeplrEmbedChainInfo
