import { CHAIN_NAME, COIN_DECIMALS, COIN_DENOM, COIN_MINIMAL_DENOM } from '@/constants/chain'
import { AssetInfo } from '@/utils/AssetUtils'

export const assetsInfo: { [key: string]: AssetInfo; } = {
  unolus: {
    chainName: CHAIN_NAME,
    coinDenom: COIN_DENOM,
    coinMinimalDenom: COIN_MINIMAL_DENOM,
    coinDecimals: COIN_DECIMALS,
    coinAbbreviation: 'NLS',
    coinIcon: 'nls.svg'
  },
  uscrt: {
    chainName: 'Secret Network',
    coinDenom: 'scrt',
    coinMinimalDenom: 'uscrt',
    coinDecimals: COIN_DECIMALS,
    coinAbbreviation: 'SCRT',
    coinIcon: 'scrt.svg'
  },
  uluna: {
    chainName: 'Terra - LUNA',
    coinDenom: 'luna',
    coinMinimalDenom: 'uluna',
    coinDecimals: COIN_DECIMALS,
    coinAbbreviation: 'LUNA',
    coinIcon: 'terra-luna.svg'
  },
  ulum: {
    chainName: 'Lum Network',
    coinDenom: 'lum',
    coinMinimalDenom: 'ulum',
    coinDecimals: COIN_DECIMALS,
    coinAbbreviation: 'lum',
    coinIcon: 'lum.svg'
  }
}
