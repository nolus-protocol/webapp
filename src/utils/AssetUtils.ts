import { assetsInfo } from '@/config/assetsInfo'
import { AssetInfo } from '@/types/AssetInfo'

export class AssetUtils {
  public static getAssetInfoByAbbr (coinAbbreviation: string): AssetInfo {
    return this.assetsInfo()[coinAbbreviation] || this.assetsInfo().unolus
  }

  private static assetsInfo (): { [key: string]: AssetInfo; } {
    return assetsInfo
  }
}
