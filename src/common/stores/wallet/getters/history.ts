import { useHistoryStore } from "../../history";

/**
 * Get pending transfers object - delegates to useHistoryStore
 *
 * This is a facade getter for backwards compatibility.
 * Components access walletStore.history[id] to get/update pending transfers.
 */
export function history() {
  const historyStore = useHistoryStore();
  return historyStore.pendingTransfers;
}

/**
 * Get pending transfers as sorted list - delegates to useHistoryStore
 *
 * This is a facade getter for backwards compatibility.
 * Components use walletStore.historyItems for listing pending transfers.
 */
export function historyItems() {
  const historyStore = useHistoryStore();
  return historyStore.pendingTransfersList;
}

/**
 * Get activities - delegates to useHistoryStore
 *
 * This is a facade getter for backwards compatibility.
 * Components access walletStore.activities.data for transaction history.
 */
export function activities() {
  const historyStore = useHistoryStore();
  return historyStore.activities;
}
