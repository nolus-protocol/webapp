import { Coin, CoinPretty, Dec, DecUtils } from '@keplr-wallet/unit'
import { Coin as CosmosCoin } from '@cosmjs/proto-signing'
import { COIN_DECIMALS, COIN_DENOM, COIN_MINIMAL_DENOM } from '../constants/chain'

export class CurrencyUtils {
  public static convertNolusToUNolus (tokenAmount: string): Coin {
    return this.convertDenomToMinimalDenom(tokenAmount, COIN_MINIMAL_DENOM, COIN_DECIMALS)
  }

  public static convertDenomToMinimalDenom (tokenAmount: string, minimalDenom: string, decimals: number): Coin {
    if (tokenAmount.trim() === '') {
      return new Coin(minimalDenom, new Dec('0').truncate())
    }
    const amount = new Dec(tokenAmount).mul(DecUtils.getPrecisionDec(decimals)).truncate()
    const coin = new Coin(minimalDenom, amount)
    return coin
  }

  public static convertCoinUNolusToNolus (tokenAmount: Coin | null | undefined): CoinPretty | null {
    return this.convertCoinMinimalDenomToDenom(tokenAmount, COIN_MINIMAL_DENOM, COIN_DENOM, COIN_DECIMALS)
  }

  public static convertCoinMinimalDenomToDenom (
    tokenAmount: Coin | null | undefined,
    minimalDenom: string,
    denom: string,
    decimals: number
  ): CoinPretty | null {
    if (tokenAmount === null || tokenAmount === undefined) {
      return null
    }
    const amount = new Dec(tokenAmount.amount.toString())
    return new CoinPretty({
      coinDecimals: decimals,
      coinMinimalDenom: minimalDenom,
      coinDenom: denom
    }, amount)
  }

  public static convertUNolusToNolus (tokenAmount: string): CoinPretty {
    return this.convertMinimalDenomToDenom(tokenAmount, COIN_MINIMAL_DENOM, COIN_DENOM, COIN_DECIMALS)
  }

  public static convertMinimalDenomToDenom (
    tokenAmount: string,
    minimalDenom: string,
    denom: string,
    decimals: number
  ): CoinPretty {
    const amount = new Dec(tokenAmount)
    return new CoinPretty({
      coinDecimals: decimals,
      coinMinimalDenom: minimalDenom,
      coinDenom: denom
    }, amount)
  }

  public static convertCosmosCoinToKeplCoin (cosmosCoin: CosmosCoin | undefined): Coin {
    if (!cosmosCoin) {
      return new Coin('', 0)
    }
    return new Coin(cosmosCoin.denom, cosmosCoin.amount)
  }
}
