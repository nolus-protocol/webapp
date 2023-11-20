import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (
  chainId: string,
  tendermintRpc: string,
  rest: string
): ChainInfo => {
  return {
    chainId: chainId,
    chainName: 'Celestia',
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118,
    },
    bech32Config: {
      bech32PrefixAccAddr: 'celestia',
      bech32PrefixAccPub: 'celestiapub',
      bech32PrefixValAddr: 'celestiavaloper',
      bech32PrefixValPub: 'celestiavaloperpub',
      bech32PrefixConsAddr: 'celestiavalcons',
      bech32PrefixConsPub: 'celestiavalconspub',
    },
    currencies: [
      {
        coinDenom: 'tia',
        coinMinimalDenom: 'utia',
        coinDecimals: 8,
        coinGeckoId: 'celestia',
      },
    ],
    feeCurrencies: [
      {
        coinDenom: 'tia',
        coinMinimalDenom: 'utia',
        coinDecimals: 8,
        coinGeckoId: 'celestia',
      },
    ],
    stakeCurrency: {
      coinDenom: 'tia',
      coinMinimalDenom: 'utia',
      coinDecimals: 8,
      coinGeckoId: 'celestia',
    },
    features: ["ibc-transfer"],
  };
};

export { embedChainInfo };
