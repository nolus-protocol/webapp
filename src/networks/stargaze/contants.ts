import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Stargaze",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "stars",
      bech32PrefixAccPub: "starspub",
      bech32PrefixValAddr: "starsvaloper",
      bech32PrefixValPub: "starsvaloperpub",
      bech32PrefixConsAddr: "starsvalcons",
      bech32PrefixConsPub: "starsvalconspub"
    },
    currencies: [
      {
        coinDenom: "stars",
        coinMinimalDenom: "ustars",
        coinDecimals: 6,
        coinGeckoId: "stargaze"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "stars",
        coinMinimalDenom: "ustars",
        coinDecimals: 6,
        coinGeckoId: "stargaze"
      }
    ],
    stakeCurrency: {
      coinDenom: "stars",
      coinMinimalDenom: "ustars",
      coinDecimals: 6,
      coinGeckoId: "stargaze"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
