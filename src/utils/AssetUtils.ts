import { Buffer } from 'buffer'
import { Hash } from '@keplr-wallet/crypto'
import { assetsInfo } from '@/config/assetsInfo'

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
    return assetsInfo
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
