import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Babylon Genesis",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "bbn",
      bech32PrefixAccPub: "bbnpub",
      bech32PrefixValAddr: "bbnvaloper",
      bech32PrefixValPub: "bbnvaloperpub",
      bech32PrefixConsAddr: "bbnvalcons",
      bech32PrefixConsPub: "bbnvalconspub"
    },
    currencies: [
      {
        coinDenom: "bbn",
        coinMinimalDenom: "ubbn",
        coinDecimals: 6,
        coinGeckoId: "babylon"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "bbn",
        coinMinimalDenom: "ubbn",
        coinDecimals: 6,
        coinGeckoId: "babylon"
      }
    ],
    stakeCurrency: {
      coinDenom: "bbn",
      coinMinimalDenom: "ubbn",
      coinDecimals: 6,
      coinGeckoId: "babylon"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
