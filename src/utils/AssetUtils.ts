import type { AssetInfo } from '@/types';
import { assetsInfo } from '@/config/assetsInfo';

import { Buffer } from 'buffer';
import { Hash } from '@keplr-wallet/crypto';
export class AssetUtils {
  
  //TODO delete
  public static getAssetInfoByAbbr(coinAbbreviation: string): AssetInfo {
    return this.assetsInfo()[coinAbbreviation] || this.assetsInfo().unls;
  }

  //TODO delete
  private static assetsInfo(): { [key: string]: AssetInfo } {
    return assetsInfo;
  }

  //Todo add to nolus.js
  public static makeIBCMinimalDenom(sourceChannelId: string[], coinMinimalDenom: string): string {
    if(sourceChannelId.length == 0){
      return coinMinimalDenom;
    }

    let path = sourceChannelId.reduce((a, b) => {
      a += `transfer/${b}/`;
      return a;
    }, '');
    path+=`${coinMinimalDenom}`;

    return (
      'ibc/' +
      Buffer.from(Hash.sha256(Buffer.from(path)))
        .toString('hex')
        .toUpperCase()
    );
  }
}
