import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Cudos",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "acudos",
      bech32PrefixAccPub: "acudospub",
      bech32PrefixValAddr: "acudosvaloper",
      bech32PrefixValPub: "acudosvaloperpub",
      bech32PrefixConsAddr: "acudosvalcons",
      bech32PrefixConsPub: "acudosvalconspub"
    },
    currencies: [
      {
        coinDenom: "cudos",
        coinMinimalDenom: "acudos",
        coinDecimals: 6,
        coinGeckoId: "cudos"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "cudos",
        coinMinimalDenom: "acudos",
        coinDecimals: 6,
        coinGeckoId: "cudos"
      }
    ],
    stakeCurrency: {
      coinDenom: "cudos",
      coinMinimalDenom: "acudos",
      coinDecimals: 6,
      coinGeckoId: "cudos"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
