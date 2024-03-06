import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Evmos",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 60
    },
    bech32Config: {
      bech32PrefixAccAddr: "evmos",
      bech32PrefixAccPub: "evmospub",
      bech32PrefixValAddr: "evmosvaloper",
      bech32PrefixValPub: "evmosvaloperpub",
      bech32PrefixConsAddr: "evmosvalcons",
      bech32PrefixConsPub: "evmosvalconspub"
    },
    currencies: [
      {
        coinDenom: "evmos",
        coinMinimalDenom: "aevmos",
        coinDecimals: 18,
        coinGeckoId: "evmos"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "evmos",
        coinMinimalDenom: "aevmos",
        coinDecimals: 18,
        coinGeckoId: "evmos"
      }
    ],
    stakeCurrency: {
      coinDenom: "evmos",
      coinMinimalDenom: "aevmos",
      coinDecimals: 18,
      coinGeckoId: "evmos"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
