import type { Store } from "../types";
import { AppUtils, WalletManager, WalletUtils } from "@/common/utils";
import { ChainConstants } from "@nolus/nolusjs";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { NATIVE_ASSET } from "@/config/global";
import { Intercom } from "@/common/utils/Intercom";

export async function loadStakedTokens(this: Store) {
  if (!WalletUtils.isAuth()) {
    return false;
  }

  try {
    const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
    const data = await fetch(`${url}/cosmos/staking/v1beta1/delegations/${WalletManager.getWalletAddress()}`);
    const json = await data.json();

    if (json.delegation_responses) {
      const s = new Coin(NATIVE_ASSET.denom, new Int(0));
      let am = new Int(0);
      for (const item of json.delegation_responses) {
        am = am.add(new Int(item.balance.amount));
      }
      s.amount = am;
      this.stakingBalance = s;
      Intercom.update({ Nlsamountdelegated: new Dec(s?.amount ?? 0, NATIVE_ASSET.decimal_digits).toString() });
    } else {
      this.stakingBalance = new Coin(NATIVE_ASSET.denom, new Int(0));
    }
  } catch (e) {
    this.stakingBalance = new Coin(NATIVE_ASSET.denom, new Int(0));
  }
}
