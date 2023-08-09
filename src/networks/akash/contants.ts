import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (
  chainId: string,
  tendermintRpc: string,
  rest: string
): ChainInfo => {
  return {
    chainId: chainId,
    chainName: 'Akash',
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118,
    },
    bech32Config: {
      bech32PrefixAccAddr: 'akash',
      bech32PrefixAccPub: 'akashpub',
      bech32PrefixValAddr: 'akashvaloper',
      bech32PrefixValPub: 'akashvaloperpub',
      bech32PrefixConsAddr: 'akashvalcons',
      bech32PrefixConsPub: 'akashvalconspub',
    },
    currencies: [
      {
        coinDenom: 'akt',
        coinMinimalDenom: 'uakt',
        coinDecimals: 6,
        coinGeckoId: 'akash-network',
      },
    ],
    feeCurrencies: [
      {
        coinDenom: 'akt',
        coinMinimalDenom: 'uakt',
        coinDecimals: 6,
        coinGeckoId: 'akash-network',
      },
    ],
    stakeCurrency: {
      coinDenom: 'akt',
      coinMinimalDenom: 'uakt',
      coinDecimals: 6,
      coinGeckoId: 'akash-network',
    },
    features: ["ibc-transfer"],
  };
};

export { embedChainInfo };
