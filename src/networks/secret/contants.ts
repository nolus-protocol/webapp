import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Secret",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "secret",
      bech32PrefixAccPub: "secretpub",
      bech32PrefixValAddr: "secretvaloper",
      bech32PrefixValPub: "secretvaloperpub",
      bech32PrefixConsAddr: "secretvalcons",
      bech32PrefixConsPub: "secretvalconspub"
    },
    currencies: [
      {
        coinDenom: "scrt",
        coinMinimalDenom: "uscrt",
        coinDecimals: 6,
        coinGeckoId: "secret"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "scrt",
        coinMinimalDenom: "uscrt",
        coinDecimals: 6,
        coinGeckoId: "secret"
      }
    ],
    stakeCurrency: {
      coinDenom: "scrt",
      coinMinimalDenom: "uscrt",
      coinDecimals: 6,
      coinGeckoId: "secret"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
