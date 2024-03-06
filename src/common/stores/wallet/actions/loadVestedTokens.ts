import type { Store } from "../types";
import { AppUtils, WalletManager, WalletUtils } from "@/common/utils";
import { ChainConstants } from "@nolus/nolusjs";

export async function loadVestedTokens(this: Store): Promise<
  {
    endTime: string;
    amount: { amount: string; denom: string };
  }[]
> {
  if (!WalletUtils.isAuth()) {
    this.vest = [];
    this.delegated_vesting = undefined;
    this.delegated_free = undefined;
    return [];
  }

  const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
  const data = await fetch(`${url}/cosmos/auth/v1beta1/accounts/${WalletManager.getWalletAddress()}`);

  const json = await data.json();
  const accData = json.account;
  const vesting_account = accData?.base_vesting_account;
  const items = [];
  const vest = [];

  if (vesting_account) {
    const start = new Date(accData.start_time * 1000);
    const end = new Date(vesting_account.end_time * 1000);

    const from = `${start.toLocaleDateString("en-US", {
      day: "2-digit"
    })}/${start.toLocaleDateString("en-US", {
      month: "2-digit"
    })}/${start.toLocaleDateString("en-US", { year: "numeric" })}`;
    const to = `${end.toLocaleDateString("en-US", {
      day: "2-digit"
    })}/${end.toLocaleDateString("en-US", {
      month: "2-digit"
    })}/${end.toLocaleDateString("en-US", { year: "numeric" })}`;

    items.push({
      endTime: `${from} - ${to}`,
      amount: vesting_account.original_vesting[0]
    });

    vest.push({
      start,
      end,
      amount: vesting_account.original_vesting[0]
    });

    this.vest = vest;
    this.delegated_vesting = vesting_account.delegated_vesting[0];
    this.delegated_free = vesting_account.delegated_free[0];
  } else {
    this.vest = [];
    this.delegated_vesting = undefined;
    this.delegated_free = undefined;
  }

  return items;
}
