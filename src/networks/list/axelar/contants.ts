import type { ChainInfo } from "@keplr-wallet/types";

const embedChainInfo = (chainId: string, tendermintRpc: string, rest: string): ChainInfo => {
  return {
    chainId: chainId,
    chainName: "Axelar",
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: 118
    },
    bech32Config: {
      bech32PrefixAccAddr: "axelar",
      bech32PrefixAccPub: "axelarpub",
      bech32PrefixValAddr: "axelarvaloper",
      bech32PrefixValPub: "axelarvaloperpub",
      bech32PrefixConsAddr: "axelarvalcons",
      bech32PrefixConsPub: "axelarvalconspub"
    },
    currencies: [
      {
        coinDenom: "axl",
        coinMinimalDenom: "uaxl",
        coinDecimals: 6,
        coinGeckoId: "axelar"
      }
    ],
    feeCurrencies: [
      {
        coinDenom: "axl",
        coinMinimalDenom: "uaxl",
        coinDecimals: 6,
        coinGeckoId: "axelar"
      }
    ],
    stakeCurrency: {
      coinDenom: "axl",
      coinMinimalDenom: "uaxl",
      coinDecimals: 6,
      coinGeckoId: "axelar"
    },
    features: ["ibc-transfer"]
  };
};

export { embedChainInfo };
