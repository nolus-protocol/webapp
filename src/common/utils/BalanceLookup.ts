/**
 * BalanceLookup - Wallet balance lookup utilities
 */

import { useWalletStore } from "../stores/wallet";
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


