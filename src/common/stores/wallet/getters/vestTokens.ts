import type { State } from "../types";
import { ChainConstants } from "@nolus/nolusjs";
import { Dec, Int } from "@keplr-wallet/unit";

// The parameter is narrowed to the slice this getter reads: Pinia checks
// getters against UnwrapRef<State>, and the unwrapped NolusWallet under the
// optional `wallet` key is no longer assignable back to the class type under
// the strict tsconfig floor.
export function vestTokens(state: Pick<State, "vest">) {
  let balance = new Dec(0, ChainConstants.COIN_DECIMALS);

  for (const b of state.vest) {
    const date = new Date();
    const diff = b.end.getTime() - b.start.getTime();
    const diffNow = date.getTime() - b.start.getTime();
    let q = diffNow / diff;

    if (q > 1) {
      q = 1;
    }

    if (q < 0) {
      q = 0;
    }

    const amount = new Dec(b.amount.amount, ChainConstants.COIN_DECIMALS);
    const notAvailable = amount.sub(amount.mul(new Dec(q)));
    balance = balance.add(notAvailable);
  }

  const int = new Int(balance.mul(new Dec(10).pow(new Int(ChainConstants.COIN_DECIMALS))).toString(0));

  return { amount: int, denom: ChainConstants.COIN_MINIMAL_DENOM };
}
