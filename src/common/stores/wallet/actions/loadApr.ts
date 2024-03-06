import type { Store } from "../types";
import { AppUtils } from "@/common/utils";
import { ChainConstants } from "@nolus/nolusjs";

export async function loadApr(this: Store) {
  try {
    const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
    const [stakingBalance, infolation_data] = await Promise.all([
      fetch(`${url}/cosmos/staking/v1beta1/pool`).then((data) => data.json()),
      fetch(`${url}/nolus/mint/v1beta1/annual_inflation`).then((data) => data.json())
    ]);
    const bonded = Number(stakingBalance.pool.bonded_tokens);
    const inflation = Number(infolation_data.annual_inflation ?? 0);
    this.apr = (inflation / bonded) * 100;
  } catch (error) {
    this.apr = 0;
  }
}
