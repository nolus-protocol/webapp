import type { Store } from "../types";
import { BackendApi } from "@/common/api";

export async function loadApr(this: Store) {
  try {
    const aprResponse = await BackendApi.getApr();
    const bonded = Number(aprResponse.bonded_tokens);
    const inflation = Number(aprResponse.annual_inflation ?? 0);
    if (bonded <= 0) {
      this.apr = 0;
      return;
    }
    this.apr = (inflation / bonded) * 100;
  } catch (error) {
    console.error("[WalletStore] Failed to load APR:", error);
    this.apr = 0;
  }
}
