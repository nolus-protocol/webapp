import type { Coin } from "@cosmjs/proto-signing";
import type { StdFee } from "@cosmjs/amino";
import { i18n } from "@/i18n";
import { Dec, Int } from "@keplr-wallet/unit";
import { fromBech32 } from "@cosmjs/encoding";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";
import { WalletManager } from ".";
import { getCurrencyByDenom } from "./CurrencyLookup";
import { type NetworkData, WalletConnectMechanism } from "@/common/types";
import { authenticateKeplr, authenticateLeap, authenticateLedger, type BaseWallet, type Wallet } from "@/networks";
import { authenticateEvmPhantom, authenticateSolFlare } from "@/networks/cosm/WalletFactory";

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
  const hasDot = amount?.at?.(0) == ".";

  if (!amount || hasDot) {
    return i18n.global.t("message.invalid-amount");
  }

  const asset = getCurrencyByDenom(denom);
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

export const validateAmountV2 = (amount: string, amount2: string) => {
  amount = removeSpace(removeComma(amount?.toString() ?? ""));
  amount2 = removeSpace(removeComma(amount2?.toString() ?? ""));

  const hasDot = amount?.at?.(0) == ".";

  if (!amount || hasDot) {
    return i18n.global.t("message.invalid-amount");
  }

  const a = new Dec(amount);
  const b = new Dec(amount2);

  const isLowerThanOrEqualsToZero = a.lte(new Dec(0));

  if (isLowerThanOrEqualsToZero) {
    return i18n.global.t("message.invalid-balance-low");
  }

  const isGreaterThanWalletBalance = a.gt(b);

  if (isGreaterThanWalletBalance) {
    return i18n.global.t("message.invalid-balance-big");
  }

  return "";
};

const walletActionMap: Record<WalletConnectMechanism, WalletActions> = {
  [WalletConnectMechanism.KEPLR]: WalletActions.CONNECT_KEPLR,
  [WalletConnectMechanism.LEAP]: WalletActions.CONNECT_LEAP,
  [WalletConnectMechanism.EVM_PHANTOM]: WalletActions.CONNECT_EVM_PHANTOM,
  [WalletConnectMechanism.SOL_SOLFLARE]: WalletActions.CONNECT_SOL_SOLFLARE,
  [WalletConnectMechanism.LEDGER]: WalletActions.CONNECT_LEDGER,
  [WalletConnectMechanism.LEDGER_BLUETOOTH]: WalletActions.CONNECT_LEDGER
};

const externalWalletMap: Record<
  WalletConnectMechanism,
  (wallet: Wallet, network: NetworkData) => Promise<BaseWallet | undefined>
> = {
  [WalletConnectMechanism.KEPLR]: authenticateKeplr,
  [WalletConnectMechanism.LEAP]: authenticateLeap,
  [WalletConnectMechanism.EVM_PHANTOM]: authenticateEvmPhantom,
  [WalletConnectMechanism.SOL_SOLFLARE]: authenticateSolFlare,
  [WalletConnectMechanism.LEDGER]: authenticateLedger,
  [WalletConnectMechanism.LEDGER_BLUETOOTH]: authenticateLedger
};

export const walletOperation = async (operation: () => void | Promise<void>) => {
  const walletStore = useWalletStore();
  const mechanism = WalletManager.getWalletConnectMechanism();
  if (mechanism) {
    const action = walletActionMap[mechanism];
    await walletStore[action]();
  }
  await operation();
};

export const externalWallet = async (wallet: Wallet, networkData: NetworkData) => {
  const mechanism = WalletManager.getWalletConnectMechanism();
  if (mechanism) {
    return await externalWalletMap[mechanism](wallet, networkData);
  }
};

export const getMicroAmount = (denom: string, amount: string) => {
  const asset = getCurrencyByDenom(denom);
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

  const asset = getCurrencyByDenom(denom);
  const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amount, asset.ibcData, asset.decimal_digits);

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

  return result;
};

const removeComma = (n: string) => n.replace(/,/g, "");
const removeSpace = (n: string) => n.replace(/\s/g, "");
