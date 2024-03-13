import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Injective",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 60
    },
    bech32Config: {
      bech32PrefixAccAddr: "inj",
      bech32PrefixAccPub: "injpub",
      bech32PrefixValAddr: "injvaloper",
      bech32PrefixValPub: "injvaloperpub",
      bech32PrefixConsAddr: "injvalcons",
      bech32PrefixConsPub: "injvalconspub"
    },
    currencies: [
      {
        coinDenom: "inj",
        coinMinimalDenom: "inj",
        coinDecimals: 18,
        coinGeckoId: "injective-protocol"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "inj",
        coinMinimalDenom: "inj",
        coinDecimals: 18,
        coinGeckoId: "injective-protocol"
      }
    ],
    stakeCurrency: {
      coinDenom: "inj",
      coinMinimalDenom: "inj",
      coinDecimals: 18,
      coinGeckoId: "injective-protocol"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
