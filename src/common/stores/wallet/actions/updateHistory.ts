import { type IObjectKeys } from "@/common/types";
import { type Store } from "../types";
import { useHistoryStore } from "../../history";

/**
 * Update history - delegates to useHistoryStore
 * 
 * This is a facade action for backwards compatibility.
 * Components should migrate to using useHistoryStore.addPendingTransfer() directly.
 */
export function updateHistory(this: Store, history: IObjectKeys, i18n: IObjectKeys) {
  const historyStore = useHistoryStore();
  historyStore.addPendingTransfer(history, i18n);
}
