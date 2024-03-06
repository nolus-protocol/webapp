import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Stride",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "stride",
      bech32PrefixAccPub: "stridepub",
      bech32PrefixValAddr: "stridevaloper",
      bech32PrefixValPub: "stridevaloperpub",
      bech32PrefixConsAddr: "stridevalcons",
      bech32PrefixConsPub: "stridevalconspub"
    },
    currencies: [
      {
        coinDenom: "strd",
        coinMinimalDenom: "ustrd",
        coinDecimals: 6,
        coinGeckoId: "stride"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "strd",
        coinMinimalDenom: "ustrd",
        coinDecimals: 6,
        coinGeckoId: "stride"
      }
    ],
    stakeCurrency: {
      coinDenom: "strd",
      coinMinimalDenom: "ustrd",
      coinDecimals: 6,
      coinGeckoId: "stride"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
