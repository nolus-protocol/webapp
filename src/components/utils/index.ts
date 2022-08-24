import { Dec, Int } from '@keplr-wallet/unit'
import { fromBech32 } from '@cosmjs/encoding'
import { ChainConstants } from '@nolus/nolusjs/build/constants'
import { CurrencyUtils } from '@nolus/nolusjs'

import { useStore } from '@/store'
import { WalletUtils } from '@/utils/WalletUtils'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { assetsInfo } from '@/config/assetsInfo'

export const validateAddress = (address: string) => {
  if (!address || address.trim() == '') {
    console.log('missing receiver address')
    return 'missing receiver address'
  }

  try {
    fromBech32(address, 44)
    return ''
  } catch (e) {
    console.log('address is not valid!')
    return 'address is not valid!'
  }
}

export const validateAmount = (amount: string, denom: string, balance: number) => {
  if (!amount) {
    return 'missing amount value'
  }

  const { coinMinimalDenom,coinDecimals } = assetsInfo[denom]
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amount, coinMinimalDenom, coinDecimals)
  const walletBalance = String(balance || 0)

  const isLowerThanOrEqualsToZero = new Dec(
    minimalDenom.amount || '0'
  ).lte(new Dec(0))
  const isGreaterThanWalletBalance = new Int(
    minimalDenom.amount.toString() || '0'
  ).gt(new Int(walletBalance))

  if (isLowerThanOrEqualsToZero) {
    console.log('balance is too low')
    return 'balance is too low'
  }
  if (isGreaterThanWalletBalance) {
    console.log('balance is too big')
    return 'balance is too big'
  }

  return ''
}

export const transferCurrency = async (denom: string, amount: string, receiverAddress: string, memo: string = '') => {
  const wallet = useStore().getters.getNolusWallet

  const result = {
    success: false,
    txHash: ''
  }

  if (!wallet) {
    return result
  }

  const feeDecimals = new Int(10).pow(new Int(6).absUInt())
  const feeAmount = new Dec('0.25').mul(new Dec(feeDecimals))
  console.log('feeAmount: ', feeAmount.truncate().toString())
  const DEFAULT_FEE = {
    amount: [
      {
        denom: ChainConstants.COIN_MINIMAL_DENOM,
        amount: WalletUtils.isConnectedViaExtension()
          ? '0.25'
          : feeAmount.truncate().toString()
      }
    ],
    gas: '100000'
  }

  const {
    coinMinimalDenom,
    coinDecimals
  } = assetsInfo[denom]
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amount, coinMinimalDenom, coinDecimals)

  try {
    const txResponse = await useStore().dispatch(
      WalletActionTypes.TRANSFER_TOKENS,
      {
        receiverAddress,
        fee: DEFAULT_FEE,
        memo,
        funds: [
          {
            amount: minimalDenom.amount.toString(),
            denom
          }
        ]
      }
    )

    if (txResponse) {
      result.success = txResponse.code === 0
      result.txHash = txResponse.transactionHash
    }
  } catch (e) {
    console.error('Transaction failed. ', e)
  }

  return result
}
