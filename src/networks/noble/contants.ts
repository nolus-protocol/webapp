import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Noble",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "noble",
      bech32PrefixAccPub: "noblepub",
      bech32PrefixValAddr: "noblevaloper",
      bech32PrefixValPub: "noblevaloperpub",
      bech32PrefixConsAddr: "noblevalcons",
      bech32PrefixConsPub: "noblevalconspub"
    },
    currencies: [
      {
        coinDenom: "usdc",
        coinMinimalDenom: "uusdc",
        coinDecimals: 6,
        coinGeckoId: "usd-coin"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "usdc",
        coinMinimalDenom: "uusdc",
        coinDecimals: 6,
        coinGeckoId: "usd-coin"
      }
    ],
    stakeCurrency: {
      coinDenom: "usdc",
      coinMinimalDenom: "uusdc",
      coinDecimals: 6,
      coinGeckoId: "usd-coin"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
