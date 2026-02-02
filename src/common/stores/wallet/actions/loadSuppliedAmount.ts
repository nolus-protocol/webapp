import type { Store } from "../types";
import { Dec } from "@keplr-wallet/unit";
import { WalletManager, WalletUtils } from "@/common/utils";
import { BackendApi, type EarnPositionsResponse } from "@/common/api";

export async function loadSuppliedAmount(this: Store) {
  const walletAddress = this?.wallet?.address ?? WalletManager.getWalletAddress();
  
  if (!WalletUtils.isAuth() || !walletAddress) {
    this.suppliedBalance = {};
    this.lppPrice = {};
    return;
  }

  try {
    // Fetch earn positions from backend - returns EarnPositionsResponse
    const response: EarnPositionsResponse = await BackendApi.getEarnPositions(walletAddress);
    
    const suppliedBalance: { [protocol: string]: string } = {};
    const lppPrice: { [protocol: string]: Dec } = {};

    for (const position of response.positions) {
      // Use deposited_nlpn (nLPN receipt tokens) for the supplied balance
      suppliedBalance[position.protocol] = position.deposited_nlpn;
      // Use lpp_price for the nLPN to LPN conversion ratio
      lppPrice[position.protocol] = new Dec(position.lpp_price || "1");
    }

    this.suppliedBalance = suppliedBalance;
    this.lppPrice = lppPrice;
  } catch (e) {
    console.error("[loadSuppliedAmount] Failed to load earn positions:", e);
    this.suppliedBalance = {};
    this.lppPrice = {};
  }
}
