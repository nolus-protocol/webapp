import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (
  chainId: string,
  tendermintRpc: string,
  rest: string
): ChainInfo => {
  return {
    chainId: chainId,
    chainName: 'Osmosis',
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118,
    },
    bech32Config: {
      bech32PrefixAccAddr: 'osmo',
      bech32PrefixAccPub: 'osmopub',
      bech32PrefixValAddr: 'osmovaloper',
      bech32PrefixValPub: 'osmovaloperpub',
      bech32PrefixConsAddr: 'osmovalcons',
      bech32PrefixConsPub: 'osmovalconspub',
    },
    currencies: [
      {
        coinDenom: 'osmo',
        coinMinimalDenom: 'uosmo',
        coinDecimals: 6,
        coinGeckoId: 'osmosis',
      },
    ],
    feeCurrencies: [
      {
        coinDenom: 'osmo',
        coinMinimalDenom: 'uosmo',
        coinDecimals: 6,
        coinGeckoId: 'osmosis',
      },
    ],
    stakeCurrency: {
      coinDenom: 'osmo',
      coinMinimalDenom: 'uosmo',
      coinDecimals: 6,
      coinGeckoId: 'osmosis',
    },
    coinType: 118,
    features: ["ibc-transfer"],
  };
};

export { embedChainInfo };
