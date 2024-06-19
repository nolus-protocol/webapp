import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Composable",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "centauri",
      bech32PrefixAccPub: "centauripub",
      bech32PrefixValAddr: "centaurivaloper",
      bech32PrefixValPub: "centaurivaloperpub",
      bech32PrefixConsAddr: "centaurivalcons",
      bech32PrefixConsPub: "centaurivalconspub"
    },
    currencies: [
      {
        coinDenom: "pica",
        coinMinimalDenom: "ppica",
        coinDecimals: 6,
        coinGeckoId: "centauri"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "pica",
        coinMinimalDenom: "ppica",
        coinDecimals: 6,
        coinGeckoId: "centauri"
      }
    ],
    stakeCurrency: {
      coinDenom: "pica",
      coinMinimalDenom: "ppica",
      coinDecimals: 6,
      coinGeckoId: "centauri"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
