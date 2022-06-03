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
