import type { Store } from "../types";
import { WalletManager, WalletUtils } from "@/common/utils";
import { Coin, Int } from "@keplr-wallet/unit";
import { NATIVE_ASSET } from "@/config/global";
import { BackendApi, type StakingPositionsResponse } from "@/common/api";

export async function loadStakedTokens(this: Store) {
  if (!WalletUtils.isAuth()) {
    this.stakingBalance = new Coin(NATIVE_ASSET.denom, new Int(0));
    return false;
  }

  try {
    const walletAddress = WalletManager.getWalletAddress();
    if (!walletAddress) {
      this.stakingBalance = new Coin(NATIVE_ASSET.denom, new Int(0));
      return false;
    }

    // Backend returns StakingPositionsResponse with delegations array
    const response: StakingPositionsResponse = await BackendApi.getStakingPositions(walletAddress);

    if (response.delegations && response.delegations.length > 0) {
      const s = new Coin(NATIVE_ASSET.denom, new Int(0));
      let totalAmount = new Int(0);
      for (const delegation of response.delegations) {
        // Each delegation has a balance object with denom and amount
        totalAmount = totalAmount.add(new Int(delegation.balance.amount));
      }
      s.amount = totalAmount;
      this.stakingBalance = s;
    } else {
      this.stakingBalance = new Coin(NATIVE_ASSET.denom, new Int(0));
    }
  } catch (e) {
    this.stakingBalance = new Coin(NATIVE_ASSET.denom, new Int(0));
  }
}
