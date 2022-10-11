import type { IbcCurrency } from '@/types';
import { ChainConstants } from '@nolus/nolusjs/build/constants';

export const oracleDenoms: string[] = ['unls', 'uusdc'];

export const supportedCurrencies: string[] = [
  ChainConstants.COIN_MINIMAL_DENOM,
  'uusdc',
];

export const IbcAssets: IbcCurrency[] = [
  {
    sourceChannelId: 'channel-115',
    coinMinimalDenom: 'ulum',
  },
];