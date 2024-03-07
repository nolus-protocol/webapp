import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Dymension",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 60
    },
    bech32Config: {
      bech32PrefixAccAddr: "adym",
      bech32PrefixAccPub: "adympub",
      bech32PrefixValAddr: "adymvaloper",
      bech32PrefixValPub: "adymvaloperpub",
      bech32PrefixConsAddr: "adymvalcons",
      bech32PrefixConsPub: "adymvalconspub"
    },
    currencies: [
      {
        coinDenom: "dym",
        coinMinimalDenom: "adym",
        coinDecimals: 18,
        coinGeckoId: "dymension"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "dym",
        coinMinimalDenom: "adym",
        coinDecimals: 18,
        coinGeckoId: "dymension"
      }
    ],
    stakeCurrency: {
      coinDenom: "dym",
      coinMinimalDenom: "adym",
      coinDecimals: 18,
      coinGeckoId: "dymension"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
