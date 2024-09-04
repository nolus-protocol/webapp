import type { ExternalCurrency } from "@/common/types";
import { ref } from "vue";

import { Logger, AssetUtils } from "@/common/utils";
import { IGNORE_TRANSFER_ASSETS } from "@/config/global";
import { useWalletStore } from "../stores/wallet";

export function useCurrecies(onError: (error: unknown) => void) {
  const b: ExternalCurrency[] = [];
  const currencies = ref<ExternalCurrency[]>([]);

  try {
    const wallet = useWalletStore();
    for (const c of wallet.balances) {
      const asset = AssetUtils.getCurrencyByDenom(c.balance.denom);
      if (!IGNORE_TRANSFER_ASSETS.includes(asset.ticker as string)) {
        b.push({ ...asset, balance: c.balance });
      }
    }
  } catch (e) {
    Logger.error(e);
    onError(e);
  }

  currencies.value = b;
  return {
    currencies
  };
}
