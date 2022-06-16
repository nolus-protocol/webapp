import { AssetInfo } from '@/utils/AssetUtils'
import { ChainConstants } from '@nolus/nolusjs'

export const assetInfo: { [key: string]: AssetInfo; } = {
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
    coinAbbreviation: 'LUM',
    coinIcon: 'lum.svg'
  },
  'ibc/8A34AF0C1943FD0DFCDE9ADBF0B2C9959C45E87E6088EA2FC6ADACD59261B8A2': {
    chainName: 'Lum Network',
    coinDenom: 'lum',
    coinMinimalDenom: 'ulum',
    coinDecimals: 6,
    coinAbbreviation: 'LUM',
    coinIcon: 'lum.svg'
  }
}
