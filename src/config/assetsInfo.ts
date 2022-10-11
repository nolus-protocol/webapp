import nlsIcon from '@/assets/icons/coins/nls.svg';
import btcIcon from '@/assets/icons/coins/btc.svg';
import lumIcon from '@/assets/icons/coins/lum.svg';
import type { AssetInfo } from '@/types';
import { ChainConstants } from '@nolus/nolusjs';

export const assetsInfo: { [key: string]: AssetInfo } = {
  unls: {
    chainName: ChainConstants.CHAIN_NAME,
    coinDenom: ChainConstants.COIN_DENOM,
    coinMinimalDenom: ChainConstants.COIN_MINIMAL_DENOM,
    coinDecimals: ChainConstants.COIN_DECIMALS,
    coinGeckoId: ChainConstants.COIN_GECKO_ID,
    coinAbbreviation: 'NLS',
    coinIcon: nlsIcon,
  },
  uusdc: {
    chainName: 'USDC',
    coinDenom: 'usdc',
    coinMinimalDenom: 'uusdc',
    coinDecimals: 6,
    coinGeckoId: 'usd-coin',
    coinAbbreviation: 'USDC',
    coinIcon: btcIcon,
  },
  'ibc/8A34AF0C1943FD0DFCDE9ADBF0B2C9959C45E87E6088EA2FC6ADACD59261B8A2': {
    chainName: 'Lum Network',
    coinDenom: 'lum',
    coinMinimalDenom: 'ulum',
    coinDecimals: 6,
    coinGeckoId: 'lum-network',
    coinAbbreviation: 'LUM',
    coinIcon: lumIcon,
  },
};
