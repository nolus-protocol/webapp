import type { Coin } from "@cosmjs/proto-signing";
import type { StdFee } from "@cosmjs/amino";
import { i18n } from "@/i18n";
import { Int } from "@keplr-wallet/unit";
import { fromBech32 } from "@cosmjs/encoding";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";
import { AssetUtils, Logger, WalletManager } from ".";
import { type NetworkData, WalletConnectMechanism } from "@/common/types";
import { authenticateKeplr, authenticateLeap, authenticateLedger, type BaseWallet, type Wallet } from "@/networks";

export const validateAddress = (address: string) => {
  if (!address || address.trim() == "") {
    return i18n.global.t("message.invalid-address");
  }

  try {
    fromBech32(address);
    return "";
  } catch (e) {
    return i18n.global.t("message.invalid-address");
  }
};

export const validateAmount = (amount: string, denom: string, balance: number) => {
  const hasDot = amount.includes(".");

  if (!amount || hasDot) {
    return i18n.global.t("message.invalid-amount");
  }

  const asset = AssetUtils.getCurrencyByDenom(denom);
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amount, asset.ibcData, asset.decimal_digits);
  const zero = CurrencyUtils.convertDenomToMinimalDenom("0", asset.ibcData, asset.decimal_digits).amount.toDec();

  const walletBalance = String(balance || 0);
  const isLowerThanOrEqualsToZero = minimalDenom.amount.toDec().lte(zero);

  const isGreaterThanWalletBalance = new Int(minimalDenom.amount.toString() || "0").gt(new Int(walletBalance));

  if (isLowerThanOrEqualsToZero) {
    return i18n.global.t("message.invalid-balance-low");
  }

  if (isGreaterThanWalletBalance) {
    return i18n.global.t("message.invalid-balance-big");
  }

  return "";
};

export const walletOperation = async (operation: () => void) => {
  const walletStore = useWalletStore();
  switch (WalletManager.getWalletConnectMechanism()) {
    case WalletConnectMechanism.KEPLR: {
      await walletStore[WalletActions.CONNECT_KEPLR]();
      break;
    }
    case WalletConnectMechanism.LEAP: {
      await walletStore[WalletActions.CONNECT_LEAP]();
      break;
    }
    case WalletConnectMechanism.LEDGER: {
      await walletStore[WalletActions.CONNECT_LEDGER]();
      break;
    }
    case WalletConnectMechanism.LEDGER_BLUETOOTH: {
      await walletStore[WalletActions.CONNECT_LEDGER]();
      break;
    }
  }

  operation();
};

export const externalWalletOperation = async (
  operation: (wallet: BaseWallet) => void,
  wallet: Wallet,
  networkData: NetworkData
) => {
  switch (WalletManager.getWalletConnectMechanism()) {
    case WalletConnectMechanism.KEPLR: {
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
  }
};

export const externalWallet = async (wallet: Wallet, networkData: NetworkData) => {
  switch (WalletManager.getWalletConnectMechanism()) {
    case WalletConnectMechanism.KEPLR: {
      return await authenticateKeplr(wallet, networkData);
    }
    case WalletConnectMechanism.LEAP: {
      return await authenticateLeap(wallet, networkData);
    }
    case WalletConnectMechanism.LEDGER: {
      return await authenticateLedger(wallet, networkData);
    }
    case WalletConnectMechanism.LEDGER_BLUETOOTH: {
      return await authenticateLedger(wallet, networkData);
    }
  }
};

export const getMicroAmount = (denom: string, amount: string) => {
  const asset = AssetUtils.getCurrencyByDenom(denom);
  const mAmount = CurrencyUtils.convertDenomToMinimalDenom(amount, asset.ibcData, asset.decimal_digits);

  return { coinMinimalDenom: asset.ibcData, coinDecimals: asset.decimal_digits, mAmount };
};

export const transferCurrency = async (denom: string, amount: string, receiverAddress: string, memo = "") => {
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
    usedFee: null
  };

  if (!wallet) {
    return result;
  }

  const asset = AssetUtils.getCurrencyByDenom(denom);
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amount, asset.ibcData, asset.decimal_digits);

  try {
    const funds: Coin[] = [
      {
        amount: minimalDenom.amount.toString(),
        denom
      }
    ];

    const { txBytes, txHash, usedFee } = await wallet.simulateBankTransferTx(receiverAddress, funds);

    result.txHash = txHash;
    result.txBytes = txBytes;
    result.usedFee = usedFee;
    result.success = true;
  } catch (e) {
    Logger.error("Transaction failed. ", e);
  }

  return result;
};
