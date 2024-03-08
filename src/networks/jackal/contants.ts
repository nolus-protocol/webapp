import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Jackal",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "jkl",
      bech32PrefixAccPub: "jklpub",
      bech32PrefixValAddr: "jklvaloper",
      bech32PrefixValPub: "jklvaloperpub",
      bech32PrefixConsAddr: "jklvalcons",
      bech32PrefixConsPub: "jklvalconspub"
    },
    currencies: [
      {
        coinDenom: "jkl",
        coinMinimalDenom: "ujkl",
        coinDecimals: 6,
        coinGeckoId: "jackal-protocol"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "jkl",
        coinMinimalDenom: "ujkl",
        coinDecimals: 6,
        coinGeckoId: "jackal-protocol"
      }
    ],
    stakeCurrency: {
      coinDenom: "jkl",
      coinMinimalDenom: "ujkl",
      coinDecimals: 6,
      coinGeckoId: "jackal-protocol"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
