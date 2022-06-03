import { AssetInfo } from '@/utils/AssetUtils'
import { ChainConstants } from '@nolus/nolusjs'

export const assetsInfo: { [key: string]: AssetInfo; } = {
  unolus: {
    chainName: ChainConstants.CHAIN_NAME,
    coinDenom: ChainConstants.COIN_DENOM,
    coinMinimalDenom: ChainConstants.COIN_MINIMAL_DENOM,
    coinDecimals: ChainConstants.COIN_DECIMALS,
    coinAbbreviation: 'NLS',
    coinIcon: 'nls.svg'
  },
  uscrt: {
    chainName: 'Secret Network',
    coinDenom: 'scrt',
    coinMinimalDenom: 'uscrt',
    coinDecimals: 6,
    coinAbbreviation: 'SCRT',
    coinIcon: 'scrt.svg'
  },
  uluna: {
    chainName: 'Terra - LUNA',
    coinDenom: 'luna',
    coinMinimalDenom: 'uluna',
    coinDecimals: 6,
    coinAbbreviation: 'LUNA',
    coinIcon: 'terra-luna.svg'
  },
  ulum: {
    chainName: 'Lum Network',
    coinDenom: 'lum',
    coinMinimalDenom: 'ulum',
    coinDecimals: 6,
    coinAbbreviation: 'lum',
    coinIcon: 'lum.svg'
  }
}
