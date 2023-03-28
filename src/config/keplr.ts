import type { ChainInfo } from "@keplr-wallet/types";
import { ChainConstants } from "@nolus/nolusjs";

const KeplrEmbedChainInfo = (
  networkName: string,
  chainId: string,
  tendermintRpc: string,
  rest: string
): ChainInfo => {
  return {
    chainId: chainId,
    chainName: ChainConstants.CHAIN_NAME + " " + networkName,
    rpc: tendermintRpc,
    rest: rest,
    bip44: {
      coinType: ChainConstants.COIN_TYPE,
    },
    bech32Config: {
      bech32PrefixAccAddr: ChainConstants.BECH32_PREFIX_ACC_ADDR,
      bech32PrefixAccPub: ChainConstants.BECH32_PREFIX_ACC_PUB,
      bech32PrefixValAddr: ChainConstants.BECH32_PREFIX_VAL_ADDR,
      bech32PrefixValPub: ChainConstants.BECH32_PREFIX_VAL_PUB,
      bech32PrefixConsAddr: ChainConstants.BECH32_PREFIX_CONS_ADDR,
      bech32PrefixConsPub: ChainConstants.BECH32_PREFIX_CONS_PUB,
    },
    currencies: [
      {
        coinDenom: ChainConstants.COIN_DENOM,
        coinMinimalDenom: ChainConstants.COIN_MINIMAL_DENOM,
        coinDecimals: ChainConstants.COIN_DECIMALS,
        coinGeckoId: ChainConstants.COIN_GECKO_ID,
      },
    ],
    feeCurrencies: [
      {
        coinDenom: ChainConstants.COIN_DENOM,
        coinMinimalDenom: ChainConstants.COIN_MINIMAL_DENOM,
        coinDecimals: ChainConstants.COIN_DECIMALS,
        coinGeckoId: ChainConstants.COIN_GECKO_ID,
      },
    ],
    stakeCurrency: {
      coinDenom: ChainConstants.COIN_DENOM,
      coinMinimalDenom: ChainConstants.COIN_MINIMAL_DENOM,
      coinDecimals: ChainConstants.COIN_DECIMALS,
      coinGeckoId: ChainConstants.COIN_GECKO_ID,
    },
    coinType: ChainConstants.COIN_TYPE,
    features: ["ibc-transfer"],
  };
};

export default KeplrEmbedChainInfo;
