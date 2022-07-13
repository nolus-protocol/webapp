import { IbcCurrency } from '@/types/IbcCurrency'
import { ChainConstants } from '@nolus/nolusjs/build/constants'

export const supportedCurrencies: string[] = [
  ChainConstants.COIN_MINIMAL_DENOM,
  'uusdc'
]

export const IbcAssets: IbcCurrency[] = [
  {
    sourceChannelId: 'channel-115',
    coinMinimalDenom: 'ulum'
  }
]
