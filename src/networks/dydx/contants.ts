import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Dydx",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "dydx",
      bech32PrefixAccPub: "dydxpub",
      bech32PrefixValAddr: "dydxvaloper",
      bech32PrefixValPub: "dydxvaloperpub",
      bech32PrefixConsAddr: "dydxvalcons",
      bech32PrefixConsPub: "dydxvalconspub"
    },
    currencies: [
      {
        coinDenom: "dydx",
        coinMinimalDenom: "adydx",
        coinDecimals: 6,
        coinGeckoId: "dydx-mainnet-1"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "dydx",
        coinMinimalDenom: "adydx",
        coinDecimals: 6,
        coinGeckoId: "dydx-mainnet-1"
      }
    ],
    stakeCurrency: {
      coinDenom: "dydx",
      coinMinimalDenom: "adydx",
      coinDecimals: 6,
      coinGeckoId: "dydx-mainnet-1"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
