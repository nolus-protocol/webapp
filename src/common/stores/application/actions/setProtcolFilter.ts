import type { Store } from "../types";
import { WalletManager } from "@/common/utils";

export function setProtcolFilter(this: Store, protocol: string) {
  try {
    this.protocolFilter = protocol;
    WalletManager.setProtocolFilter(protocol);
  } catch (error: Error | any) {
    throw new Error(error);
  }
}
