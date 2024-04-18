import type { Store } from "../types";

export function disconnect(this: Store) {
  this.wallet = undefined;
  this.walletName = undefined;
}
