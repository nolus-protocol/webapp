import { IntercomService } from "@/common/utils/IntercomService";
import { applyWalletProtocolFilter } from "@/common/utils/walletProtocolFilter";
import type { Store } from "../types";

export function disconnect(this: Store) {
  this.wallet = undefined;
  IntercomService.disconnect();
  // Clear the wallet-driven network filter so the next connect's first
  // watcher tick sees a fresh slate.
  applyWalletProtocolFilter(null);
}
