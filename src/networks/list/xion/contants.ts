import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Xion",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "xion",
      bech32PrefixAccPub: "xionpub",
      bech32PrefixValAddr: "xionvaloper",
      bech32PrefixValPub: "xionvaloperpub",
      bech32PrefixConsAddr: "xionvalcons",
      bech32PrefixConsPub: "xionvalconspub"
    },
    currencies: [
      {
        coinDenom: "xion",
        coinMinimalDenom: "uxion",
        coinDecimals: 6,
        coinGeckoId: "xion-2"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "xion",
        coinMinimalDenom: "uxion",
        coinDecimals: 6,
        coinGeckoId: "xion-2"
      }
    ],
    stakeCurrency: {
      coinDenom: "xion",
      coinMinimalDenom: "uxion",
      coinDecimals: 6,
      coinGeckoId: "xion-2"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
