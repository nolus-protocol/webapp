import type { IObjectKeys } from "@/common/types";
import { type Store } from "../types";

export function updateHistory(this: Store, history: IObjectKeys) {
  this.history[history.id] = history;
}
