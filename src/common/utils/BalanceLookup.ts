/**
 * BalanceLookup - Wallet balance lookup utilities
 *
 * Provides methods to look up and format wallet balances.
 */

import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "../stores/wallet";
import { getCurrencyByDenom } from "./CurrencyLookup";
import type { AssetBalance } from "../stores/wallet/types";

/**
 * Get balance for a specific IBC denom
 * @throws Error if currency not found
 */
export function getBalance(ibcData: string): AssetBalance {
  const wallet = useWalletStore();

  const asset = wallet?.balances.find((item) => item.balance.denom === ibcData);

  if (asset) {
    return asset;
  }

  throw new Error(`Currency not found: ${ibcData}`);
}

/**
 * Try to get balance, returns null instead of throwing
 */
export function tryGetBalance(ibcData: string): AssetBalance | null {
  try {
    return getBalance(ibcData);
  } catch {
    return null;
  }
}

/**
 * Get balance amount as a string
 */
export function getBalanceAmount(ibcData: string): string {
  const balance = tryGetBalance(ibcData);
  return balance?.balance?.amount?.toString() ?? "0";
}

/**
 * Format balance from minimal denom to display denom
 */
export function formatCurrentBalance(denom: string, amount: string): string {
  const asset = getCurrencyByDenom(denom);
  return CurrencyUtils.convertMinimalDenomToDenom(
    amount,
    denom,
    asset.ibcData!,
    asset.decimal_digits
  );
}

/**
 * Check if user has any balance for a denom
 */
export function hasBalance(ibcData: string): boolean {
  const balance = tryGetBalance(ibcData);
  if (!balance) return false;

  const amount = balance.balance?.amount?.toString() ?? "0";
  return parseFloat(amount) > 0;
}

/**
 * Get all wallet balances
 */
export function getAllBalances(): AssetBalance[] {
  const wallet = useWalletStore();
  return wallet?.balances ?? [];
}

/**
 * Get total wallet value in USD
 */
export function getTotalValueUsd(): string {
  const wallet = useWalletStore();
  return wallet?.total_unls?.balance?.amount?.toString() ?? "0";
}


