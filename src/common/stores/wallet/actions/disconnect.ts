import { IntercomService } from "@/common/utils/IntercomService";
import type { Store } from "../types";
import { useHistoryStore } from "../../history";

export function disconnect(this: Store) {
  this.wallet = undefined;
  this.walletName = undefined;
  
  // Clear history store on disconnect
  const historyStore = useHistoryStore();
  historyStore.clear();
  
  IntercomService.disconnect();
}
