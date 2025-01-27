import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Mantra",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "mantra",
      bech32PrefixAccPub: "mantrapub",
      bech32PrefixValAddr: "mantravaloper",
      bech32PrefixValPub: "mantravaloperpub",
      bech32PrefixConsAddr: "mantravalcons",
      bech32PrefixConsPub: "mantravalconspub"
    },
    currencies: [
      {
        coinDenom: "om",
        coinMinimalDenom: "uom",
        coinDecimals: 6,
        coinGeckoId: "mantra-dao"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "om",
        coinMinimalDenom: "uom",
        coinDecimals: 6,
        coinGeckoId: "mantra-dao"
      }
    ],
    stakeCurrency: {
      coinDenom: "om",
      coinMinimalDenom: "uom",
      coinDecimals: 6,
      coinGeckoId: "mantra-dao"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
