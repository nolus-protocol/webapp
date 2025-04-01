import type { State } from "../types";

export function history(state: State) {
  const activites = [];
  for (const key in state.history) {
    activites.push(state.history[key]);
  }
  return activites.sort((a, b) => b.historyData.id - a.historyData.id);
}
