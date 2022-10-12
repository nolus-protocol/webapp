import type { IbcCurrency } from '@/types';
import { ChainConstants } from '@nolus/nolusjs/build/constants';

export const oracleDenoms: string[] = ['unls', 'uusdc'];

export const supportedCurrencies: string[] = [
  ChainConstants.COIN_MINIMAL_DENOM,
  'ibc/fj29fj0fj',
];

export const IbcAssets: IbcCurrency[] = [];