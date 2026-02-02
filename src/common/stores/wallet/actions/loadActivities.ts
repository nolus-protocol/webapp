import { type Store } from "../types";
import { useHistoryStore } from "../../history";

/**
 * Load activities - delegates to useHistoryStore
 * 
 * This is a facade action for backwards compatibility.
 * Components should migrate to using useHistoryStore.loadActivities() directly.
 */
export async function loadActivities(this: Store) {
  const historyStore = useHistoryStore();
  
  // Ensure historyStore has the current address
  if (this.wallet?.address && historyStore.address !== this.wallet.address) {
    historyStore.setAddress(this.wallet.address);
  }
  
  await historyStore.loadActivities();
}
