import type { State } from "../types";

//TODO: remove
export function getCurrencySymbol(state: State) {
  return (ticker: string, protocol?: string) => {
    const c = state.currenciesData?.[`${ticker}@${protocol}`];

    if (c) {
      return c;
    }

    for (const key in state.currenciesData) {
      const currency = state.currenciesData[key];
      if (ticker == currency.ticker) {
        return currency;
      }
    }
  };
}
