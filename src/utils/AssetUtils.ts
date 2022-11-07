import { Buffer } from 'buffer';
import { Hash } from '@keplr-wallet/crypto';
export class AssetUtils {

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
