import type { Coin } from "@cosmjs/proto-signing";
import type { StdFee } from "@cosmjs/amino";
import { type BaseWallet, type Wallet } from "@/networks";
import { i18n } from "@/i18n";

import { Int } from "@keplr-wallet/unit";
import { fromBech32 } from "@cosmjs/encoding";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore, WalletActionTypes } from "@/stores/wallet";
import { WalletManager } from "@/utils";
import { WalletConnectMechanism, type NetworkData } from "@/types";
import { authenticateKeplr, authenticateLeap, authenticateLedger, authenticateDecrypt } from "@/networks";

export const validateAddress = (address: string) => {
  if (!address || address.trim() == "") {
    return i18n.global.t("message.invalid-address");
  }

  try {
    fromBech32(address, 44);
    return "";
  } catch (e) {
    return i18n.global.t("message.invalid-address");
  }
};

export const validateAmount = (
  amount: string,
  denom: string,
  balance: number
) => {
  if (!amount) {
    return i18n.global.t("message.invalid-amount");
  }

  const walletStore = useWalletStore();
  const { coinMinimalDenom, coinDecimals } = walletStore.getCurrencyInfo(denom);
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
    amount,
    coinMinimalDenom,
    coinDecimals
  );
  const zero = CurrencyUtils.convertDenomToMinimalDenom(
    "0",
    coinMinimalDenom,
    coinDecimals
  ).amount.toDec();

  const walletBalance = String(balance || 0);
  const isLowerThanOrEqualsToZero = minimalDenom.amount.toDec().lte(zero);

  const isGreaterThanWalletBalance = new Int(
    minimalDenom.amount.toString() || "0"
  ).gt(new Int(walletBalance));

  if (isLowerThanOrEqualsToZero) {
    return i18n.global.t("message.invalid-balance-low");
  }

  if (isGreaterThanWalletBalance) {
    return i18n.global.t("message.invalid-balance-big");
  }

  return "";
};

export const walletOperation = async (
  operation: () => void,
  password: string
) => {
  const walletStore = useWalletStore();

  switch (WalletManager.getWalletConnectMechanism()) {
    case WalletConnectMechanism.MNEMONIC: {
      await walletStore[WalletActionTypes.LOAD_PRIVATE_KEY_AND_SIGN]({
        password,
      });
      break;
    }
    case WalletConnectMechanism.EXTENSION: {
      await walletStore[WalletActionTypes.CONNECT_KEPLR]();
      break;
    }
    case WalletConnectMechanism.LEAP: {
      await walletStore[WalletActionTypes.CONNECT_LEAP]();
      break;
    }
    case WalletConnectMechanism.LEDGER: {
      await walletStore[WalletActionTypes.CONNECT_LEDGER]();
      break;
    }
    case WalletConnectMechanism.LEDGER_BLUETOOTH: {
      await walletStore[WalletActionTypes.CONNECT_LEDGER]();
      break;
    }
    case WalletConnectMechanism.GOOGLE: {
      await walletStore[WalletActionTypes.CONNECT_GOOGLE]();
      break;
    }
  }

  operation();
};

export const externalWalletOperation = async (
  operation: (wallet: BaseWallet) => void,
  wallet: Wallet,
  networkData: NetworkData,
  password: string
) => {

  switch (WalletManager.getWalletConnectMechanism()) {
    case WalletConnectMechanism.MNEMONIC: {
      return operation(await authenticateDecrypt(wallet, networkData, password));
    }
    case WalletConnectMechanism.EXTENSION: {
      return operation(await authenticateKeplr(wallet, networkData));
    }
    case WalletConnectMechanism.LEAP: {
      return operation(await authenticateLeap(wallet, networkData));
    }
    case WalletConnectMechanism.LEDGER: {
      return operation(await authenticateLedger(wallet, networkData));
    }
    case WalletConnectMechanism.LEDGER_BLUETOOTH: {
      return operation(await authenticateLedger(wallet, networkData));
    }
    case WalletConnectMechanism.GOOGLE: {
      return operation(await authenticateDecrypt(wallet, networkData, password));
    }
  }

};

export const getMicroAmount = (denom: string, amount: string) => {
  if (!denom) {
    // throw new Error(i18n.global.t("message.missing-denom"));
  }

  if (!amount) {
    // throw new Error(i18n.global.t("message.missing-amount"));
  }

  const walletStore = useWalletStore();
  const { coinMinimalDenom, coinDecimals } = walletStore.getCurrencyInfo(denom);
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
  memo = ""
) => {
  const wallet = useWalletStore().wallet;

  const result: {
    success: boolean;
    txHash: string;
    txBytes: Uint8Array | null;
    usedFee: StdFee | null;
  } = {
    success: false,
    txHash: "",
    txBytes: null,
    usedFee: null,
  };

  if (!wallet) {
    return result;
  }

  const walletStore = useWalletStore();
  const { coinMinimalDenom, coinDecimals } = walletStore.getCurrencyInfo(denom);
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

    const { txBytes, txHash, usedFee } = await wallet.simulateBankTransferTx(
      receiverAddress,
      funds,
      memo
    );

    result.txHash = txHash;
    result.txBytes = txBytes;
    result.usedFee = usedFee;
    result.success = true;
  } catch (e) {
    console.error("Transaction failed. ", e);
  }

  return result;
};
