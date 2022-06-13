import { assetInfo } from '@/config/assetInfo'

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
    return assetInfo
  }

  public static getAssetInfoByAbbr (coinAbbreviation: string): AssetInfo {
    return this.assetInfo()[coinAbbreviation] || this.assetInfo().unolus
  }
}
