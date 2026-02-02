export type { AssetBalance, State } from "./state";
export { WalletActions } from "./actions";

// Store type for action methods - includes state properties and common methods
// This avoids circular import from useWalletStore
import type { State } from "./state";

export type Store = State & {
  // Add any methods that actions need to call on `this`
  $patch: (partial: Partial<State> | ((state: State) => void)) => void;
};
