import nlsIcon from '@/assets/icons/coins/nls.svg';
import usdcIcon from '@/assets/icons/coins/usdc.svg';
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
  'ibc/fj29fj0fj': {
    chainName: 'USDC',
    coinDenom: 'usdc',
    coinMinimalDenom: 'ibc/fj29fj0fj',
    coinDecimals: 6,
    coinGeckoId: 'usd-coin',
    coinAbbreviation: 'USDC',
    coinIcon: usdcIcon,
  }
};
