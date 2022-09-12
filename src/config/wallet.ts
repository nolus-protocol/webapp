import { Dec, Int } from '@keplr-wallet/unit'
import { ChainConstants } from '@nolus/nolusjs/build/constants'
import { WalletUtils } from '@/utils/WalletUtils'
import { StdFee } from '@cosmjs/stargate'

export const defaultNolusWalletFee = (): StdFee => {
  const coinDecimals = new Int(10).pow(new Int(ChainConstants.COIN_DECIMALS).absUInt())
  const feeAmount = new Dec('0.25').mul(new Dec(coinDecimals))
  return {
    amount: [{
      denom: ChainConstants.COIN_MINIMAL_DENOM,
      amount: WalletUtils.isConnectedViaExtension() ? '0.25' : feeAmount.truncate().toString()
    }],
    gas: '2000000'
  }
}
