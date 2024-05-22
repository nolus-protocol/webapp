import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Quicksilver",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "quick",
      bech32PrefixAccPub: "quickpub",
      bech32PrefixValAddr: "quickvaloper",
      bech32PrefixValPub: "quickvaloperpub",
      bech32PrefixConsAddr: "quickvalcons",
      bech32PrefixConsPub: "quickvalconspub"
    },
    currencies: [
      {
        coinDenom: "qck",
        coinMinimalDenom: "uqck",
        coinDecimals: 6,
        coinGeckoId: "quick"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "qck",
        coinMinimalDenom: "uqck",
        coinDecimals: 6,
        coinGeckoId: "quick"
      }
    ],
    stakeCurrency: {
      coinDenom: "qck",
      coinMinimalDenom: "uqck",
      coinDecimals: 6,
      coinGeckoId: "quick"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
