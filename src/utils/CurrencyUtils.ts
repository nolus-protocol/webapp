import { Coin, CoinPretty, Dec, DecUtils } from '@keplr-wallet/unit'
import { Coin as CosmosCoin } from '@cosmjs/proto-signing'
import { COIN_DECIMALS, COIN_DENOM, COIN_MINIMAL_DENOM } from '../constants/chain'

export class CurrencyUtils {
  public static convertNolusToUNolus (tokenAmount: string): Coin {
    if (tokenAmount.trim() === '') {
      return new Coin(COIN_MINIMAL_DENOM, new Dec('0').truncate())
    }
    const amount = new Dec(tokenAmount).mul(DecUtils.getPrecisionDec(COIN_DECIMALS)).truncate()
    const coin = new Coin(COIN_MINIMAL_DENOM, amount)
    return coin
  }

  public static convertCoinUNolusToNolus (tokenAmount: Coin | null | undefined): CoinPretty | null {
    if (tokenAmount === null || tokenAmount === undefined) {
      return null
    }
    const amount = new Dec(tokenAmount.amount.toString())
    return new CoinPretty({
      coinDecimals: COIN_DECIMALS,
      coinMinimalDenom: COIN_MINIMAL_DENOM,
      coinDenom: COIN_DENOM
    }, amount)
  }

  public static convertUNolusToNolus (tokenAmount: string): CoinPretty {
    const amount = new Dec(tokenAmount)
    return new CoinPretty({
      coinDecimals: COIN_DECIMALS,
      coinMinimalDenom: COIN_MINIMAL_DENOM,
      coinDenom: COIN_DENOM
    }, amount)
  }

  public static convertCosmosCoinToKeplCoin (cosmosCoin: CosmosCoin | undefined): Coin {
    if (!cosmosCoin) {
      return new Coin('', 0)
    }
    return new Coin(cosmosCoin.denom, cosmosCoin.amount)
  }
}
