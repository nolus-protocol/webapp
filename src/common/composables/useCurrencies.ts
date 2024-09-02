import type { ExternalCurrency } from "@/common/types";
import { ref } from "vue";

import { Logger, AssetUtils } from "@/common/utils";
import { IGNORE_TRANSFER_ASSETS } from "@/config/global";
import { useWalletStore } from "../stores/wallet";

export function useCurrecies(onError: (error: unknown) => void) {
  const b = ref<ExternalCurrency[]>([]);

  try {
    const currencies: { [key: string]: ExternalCurrency } = {};
    const wallet = useWalletStore();

    for (const c of wallet.balances) {
      const asset = AssetUtils.getCurrencyByDenom(c.balance.denom);
      if (!IGNORE_TRANSFER_ASSETS.includes(asset.ticker as string)) {
        currencies[c.balance.denom as string] = { ...c, ...asset };
      }
    }

    for (const c in currencies) {
      b.value.push(currencies[c]);
    }
  } catch (e) {
    Logger.error(e);
    onError(e);
  }

  return {
    currencies: b
  };
}
