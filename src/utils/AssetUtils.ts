import type { AssetInfo } from '@/types';
import { assetsInfo } from '@/config/assetsInfo';

export class AssetUtils {
  public static getAssetInfoByAbbr(coinAbbreviation: string): AssetInfo {
    return this.assetsInfo()[coinAbbreviation] || this.assetsInfo().unls;
  }

  private static assetsInfo(): { [key: string]: AssetInfo } {
    return assetsInfo;
  }
}
