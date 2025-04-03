import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Nillion",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "nillion",
      bech32PrefixAccPub: "nillionpub",
      bech32PrefixValAddr: "nillionvaloper",
      bech32PrefixValPub: "nillionvaloperpub",
      bech32PrefixConsAddr: "nillionvalcons",
      bech32PrefixConsPub: "nillionvalconspub"
    },
    currencies: [
      {
        coinDenom: "nil",
        coinMinimalDenom: "unil",
        coinDecimals: 6,
        coinGeckoId: "nillion"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "nil",
        coinMinimalDenom: "unil",
        coinDecimals: 6,
        coinGeckoId: "nillion"
      }
    ],
    stakeCurrency: {
      coinDenom: "nil",
      coinMinimalDenom: "unil",
      coinDecimals: 6,
      coinGeckoId: "nillion"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
