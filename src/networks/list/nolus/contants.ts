import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Nolus",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "nolus",
      bech32PrefixAccPub: "noluspub",
      bech32PrefixValAddr: "nolusvaloper",
      bech32PrefixValPub: "nolusvaloperpub",
      bech32PrefixConsAddr: "nolusvalcons",
      bech32PrefixConsPub: "nolusvalconspub"
    },
    currencies: [
      {
        coinDenom: "nolus",
        coinMinimalDenom: "unolus",
        coinDecimals: 6,
        coinGeckoId: "nolus"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "nolus",
        coinMinimalDenom: "unolus",
        coinDecimals: 6,
        coinGeckoId: "nolus"
      }
    ],
    stakeCurrency: {
      coinDenom: "nolus",
      coinMinimalDenom: "unolus",
      coinDecimals: 6,
      coinGeckoId: "nolus"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
