import { CHAIN_NAME, COIN_DECIMALS, COIN_DENOM, COIN_MINIMAL_DENOM } from '../constants/chain'
import { Buffer } from 'buffer'
import { Hash } from '@keplr-wallet/crypto'

export interface AssetInfo {
  chainName: string,
  coinDenom: string,
  coinMinimalDenom: string,
  coinDecimals: number,
  coinAbbreviation: string,
  coinIcon: string
}

export class AssetUtils {
  private static assetInfo (): { [key: string]: AssetInfo; } {
    return {
      unolus: {
        chainName: CHAIN_NAME,
        coinDenom: COIN_DENOM,
        coinMinimalDenom: COIN_MINIMAL_DENOM,
        coinDecimals: COIN_DECIMALS,
        coinAbbreviation: 'NLS',
        coinIcon: 'nls.svg'
      },
      uscrt: {
        chainName: 'Secret Network',
        coinDenom: 'scrt',
        coinMinimalDenom: 'uscrt',
        coinDecimals: COIN_DECIMALS,
        coinAbbreviation: 'SCRT',
        coinIcon: ''
      }
    }
  }

  public static getAssetInfoByAbbr (coinAbbreviation: string): AssetInfo {
    return this.assetInfo()[coinAbbreviation] || this.assetInfo().unolus
  }
}

export function makeIBCMinimalDenom (sourceChannelId: string, coinMinimalDenom: string): string {
  return (
    'ibc/' +
    Buffer.from(Hash.sha256(Buffer.from(`transfer/${sourceChannelId}/${coinMinimalDenom}`)))
      .toString('hex')
      .toUpperCase()
  )
}
