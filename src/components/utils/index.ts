import { Dec, Int } from '@keplr-wallet/unit'
import { fromBech32 } from '@cosmjs/encoding'
import { ChainConstants } from '@nolus/nolusjs/build/constants'
import { CurrencyUtils, NolusWallet } from '@nolus/nolusjs'

import { useStore } from '@/store'
import { WalletUtils } from '@/utils/WalletUtils'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { assetsInfo } from '@/config/assetsInfo'
import { Coin } from '@cosmjs/proto-signing'
import { defaultNolusWalletFee } from '@/config/wallet'

export const validateAddress = (address: string) => {
  if (!address || address.trim() == '') {
    return 'missing receiver address'
  }

  try {
    fromBech32(address, 44)
    return ''
  } catch (e) {
    return 'address is not valid!'
  }
}

export const validateAmount = (amount: string, denom: string, balance: number) => {
  if (!amount) {
    return 'missing amount value'
  }

  const {
    coinMinimalDenom,
    coinDecimals
  } = assetsInfo[denom]
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amount, coinMinimalDenom, coinDecimals)
  const walletBalance = String(balance || 0)

  const isLowerThanOrEqualsToZero = new Dec(
    minimalDenom.amount || '0'
  ).lte(new Dec(0))
  const isGreaterThanWalletBalance = new Int(
    minimalDenom.amount.toString() || '0'
  ).gt(new Int(walletBalance))

  if (isLowerThanOrEqualsToZero) {
    return 'balance is too low'
  }
  if (isGreaterThanWalletBalance) {
    return 'balance is too big'
  }

  return ''
}

export const walletOperation = async (operation: () => void, password: string) => {
  const wallet = useStore().state.wallet.wallet
  if (!wallet) {
    if (WalletUtils.isConnectedViaMnemonic()) {
      useStore()
        .dispatch(WalletActionTypes.LOAD_PRIVATE_KEY_AND_SIGN, {
          password: password
        })
        .then(() => {
          operation()
        })
    } else {
      useStore().dispatch(WalletActionTypes.CONNECT_KEPLR)
      await operation()
    }
  } else {
    operation()
  }
}

export const getMicroAmount = (minimalDenom: string, amount: string) => {
  if (!minimalDenom) {
    throw new Error('Missing minimal denom!')
  }

  if (!amount) {
    throw new Error('Missing amount!')
  }

  const {
    coinMinimalDenom,
    coinDecimals
  } = assetsInfo[minimalDenom]
  const mAmount = CurrencyUtils.convertDenomToMinimalDenom(amount, coinMinimalDenom, coinDecimals)

  return { coinMinimalDenom, coinDecimals, mAmount }
}

export const transferCurrency = async (denom: string, amount: string, receiverAddress: string, memo = '') => {
  const wallet = useStore().getters.getNolusWallet

  const result = {
    success: false,
    txHash: ''
  }

  if (!wallet) {
    return result
  }

  const {
    coinMinimalDenom,
    coinDecimals
  } = assetsInfo[denom]
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amount, coinMinimalDenom, coinDecimals)

  try {
    const funds: Coin[] = [
      {
        amount: minimalDenom.amount.toString(),
        denom
      }
    ]
    const txResponse = await wallet.transferAmount(
      receiverAddress,
      funds,
      defaultNolusWalletFee(),
      memo
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
