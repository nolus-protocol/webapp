import { CHAIN_NAME, COIN_DENOM } from '../constants/chain'
import { Buffer } from 'buffer'
import { Hash } from '@keplr-wallet/crypto'

interface AssetInfo {
    chainName: string,
    coinDenom: string,
    coinAbbreviation: string,
    coinIcon: string
}

export class AssetUtils {
  private static assetInfo (): { [key: string]: AssetInfo; } {
    return {
      nls: {
        chainName: CHAIN_NAME,
        coinDenom: COIN_DENOM,
        coinAbbreviation: 'NLS',
        coinIcon: './media/coins/nolus.svg'
      },
      eth: {
        chainName: 'Ethereum',
        coinDenom: 'Ether',
        coinAbbreviation: 'ETH',
        coinIcon: ''
      }
    }
  }

  public static getAssetInfoByAbbr (coinAbbreviation: string): AssetInfo {
    return this.assetInfo()[coinAbbreviation]
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
