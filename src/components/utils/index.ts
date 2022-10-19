import i18n from '@/locales';
import type { Coin } from '@cosmjs/proto-signing';

import { Int } from '@keplr-wallet/unit';
import { fromBech32 } from '@cosmjs/encoding';
import { CurrencyUtils } from '@nolus/nolusjs';
import { assetsInfo } from '@/config/assetsInfo';
import { defaultNolusWalletFee } from '@/config/wallet';
import { useWalletStore, WalletActionTypes } from '@/stores/wallet';
import { WalletUtils } from '@/utils';
import { WalletManager } from '@/wallet/WalletManager';
import { WalletConnectMechanism } from '@/types';

export const validateAddress = (address: string) => {
  if (!address || address.trim() == '') {
    return i18n.global.t('message.invalid-address');
  }

  try {
    fromBech32(address, 44);
    return '';
  } catch (e) {
    return i18n.global.t('message.invalid-address');
  }
};

export const validateAmount = (
  amount: string,
  denom: string,
  balance: number
) => {
  if (!amount) {
    return i18n.global.t('message.invalid-amount');
  }

  const { coinMinimalDenom, coinDecimals } = assetsInfo[denom];
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
    amount,
    coinMinimalDenom,
    coinDecimals
  );
  const zero = CurrencyUtils.convertDenomToMinimalDenom(
    '0',
    coinMinimalDenom,
    coinDecimals
  ).amount.toDec();

  const walletBalance = String(balance || 0);
  const isLowerThanOrEqualsToZero = minimalDenom.amount.toDec().lte(zero);

  const isGreaterThanWalletBalance = new Int(
    minimalDenom.amount.toString() || '0'
  ).gt(new Int(walletBalance));

  if (isLowerThanOrEqualsToZero) {
    return i18n.global.t('message.invalid-balance-low');
  }

  if (isGreaterThanWalletBalance) {
    return i18n.global.t('message.invalid-balance-big');
  }

  return '';
};

export const walletOperation = async (
  operation: () => void,
  password: string
) => {
  const walletStore = useWalletStore()
  const wallet = walletStore.wallet;

  if (!wallet) {

    switch(WalletManager.getWalletConnectMechanism()){
      case(WalletConnectMechanism.MNEMONIC):{
        await walletStore[WalletActionTypes.LOAD_PRIVATE_KEY_AND_SIGN]({ password });
        break;
      }
      case(WalletConnectMechanism.EXTENSION):{
        await walletStore[WalletActionTypes.CONNECT_KEPLR]();
        break;
      }
      case(WalletConnectMechanism.LEDGER):{
        await walletStore[WalletActionTypes.CONNECT_LEDGER]();
        break;
      }
      case(WalletConnectMechanism.LEDGER_BLUETOOTH):{
        await walletStore[WalletActionTypes.CONNECT_LEDGER]();
        break;
      }
    }

    operation();

  } else {
    operation();
  }
};

export const getMicroAmount = (minimalDenom: string, amount: string) => {
  if (!minimalDenom) {
    throw new Error(i18n.global.t('message.missing-denom'));
  }

  if (!amount) {
    throw new Error(i18n.global.t('message.missing-amount'));
  }

  const { coinMinimalDenom, coinDecimals } = assetsInfo[minimalDenom];
  const mAmount = CurrencyUtils.convertDenomToMinimalDenom(
    amount,
    coinMinimalDenom,
    coinDecimals
  );

  return { coinMinimalDenom, coinDecimals, mAmount };
};

export const transferCurrency = async (
  denom: string,
  amount: string,
  receiverAddress: string,
  memo = ''
) => {
  const wallet = useWalletStore().wallet;

  const result = {
    success: false,
    txHash: '',
  };

  if (!wallet) {
    return result;
  }

  const { coinMinimalDenom, coinDecimals } = assetsInfo[denom];
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
    amount,
    coinMinimalDenom,
    coinDecimals
  );

  try {
    const funds: Coin[] = [
      {
        amount: minimalDenom.amount.toString(),
        denom,
      },
    ];

    const txResponse = await wallet.transferAmount(
      receiverAddress,
      funds,
      defaultNolusWalletFee(),
      memo
    );

    if (txResponse) {
      result.success = txResponse.code === 0;
      result.txHash = txResponse.transactionHash;
    }
  } catch (e) {
    console.error('Transaction failed. ', e);
  }

  return result;
};
