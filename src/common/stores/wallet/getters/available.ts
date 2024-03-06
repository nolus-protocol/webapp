import type { State } from "../types";
import { ChainConstants } from "@nolus/nolusjs";
import { Dec, Int } from "@keplr-wallet/unit";

export function available(state: State) {
  let balance = new Dec(0, ChainConstants.COIN_DECIMALS);

  for (const b of state.balances) {
    if (b.balance.denom == ChainConstants.COIN_MINIMAL_DENOM) {
      balance = balance.add(new Dec(b.balance.amount, ChainConstants.COIN_DECIMALS));
      break;
    }
  }

  if (balance.isNegative()) {
    balance = new Dec(0);
  }

  const int = new Int(balance.mul(new Dec(10).pow(new Int(ChainConstants.COIN_DECIMALS))).toString(0));

  return { amount: int, denom: ChainConstants.COIN_MINIMAL_DENOM };
}
