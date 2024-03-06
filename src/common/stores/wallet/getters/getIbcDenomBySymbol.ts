import type { State } from "../types";

//TODO: delete or refactor
export function getIbcDenomBySymbol(state: State) {
  return (symbol: string | undefined) => {
    for (const key in state.currencies) {
      if (symbol == state.currencies[key].symbol) {
        return key;
      }
    }
  };
}
