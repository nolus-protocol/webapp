import type { Store } from "../types";
import { WalletManager, WalletUtils } from "@/common/utils";
import { BackendApi } from "@/common/api";

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

  const address = WalletManager.getWalletAddress();
  if (!address) {
    this.vest = [];
    this.delegated_vesting = undefined;
    this.delegated_free = undefined;
    return [];
  }

  const response = await BackendApi.getAccount(address);
  const accData = response.account as {
    base_vesting_account?: {
      end_time: number;
      original_vesting: { amount: string; denom: string }[];
      delegated_vesting: { amount: string; denom: string }[];
      delegated_free: { amount: string; denom: string }[];
    };
    start_time?: number;
  };

  const vesting_account = accData?.base_vesting_account;
  const items = [];
  const vest = [];

  if (vesting_account) {
    const start = new Date((accData.start_time || 0) * 1000);
    const end = new Date(vesting_account.end_time * 1000);

    const to = `${end.toLocaleDateString("en-US", {
      day: "2-digit"
    })}/${end.toLocaleDateString("en-US", {
      month: "2-digit"
    })}/${end.toLocaleDateString("en-US", { year: "numeric" })}`;

    items.push({
      endTime: `${to}`,
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
