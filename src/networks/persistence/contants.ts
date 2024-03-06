import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Persistence",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "persistence",
      bech32PrefixAccPub: "persistencepub",
      bech32PrefixValAddr: "persistencevaloper",
      bech32PrefixValPub: "persistencevaloperpub",
      bech32PrefixConsAddr: "persistencevalcons",
      bech32PrefixConsPub: "persistencevalconspub"
    },
    currencies: [
      {
        coinDenom: "xprt",
        coinMinimalDenom: "uxprt",
        coinDecimals: 6,
        coinGeckoId: "persistence"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "xprt",
        coinMinimalDenom: "uxprt",
        coinDecimals: 6,
        coinGeckoId: "persistence"
      }
    ],
    stakeCurrency: {
      coinDenom: "xprt",
      coinMinimalDenom: "uxprt",
      coinDecimals: 6,
      coinGeckoId: "persistence"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
