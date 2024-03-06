import type { Store } from "../types";
import { Dec } from "@keplr-wallet/unit";
import { WalletManager } from "@/common/utils";
import { useAdminStore } from "../../admin";
import { NolusClient } from "@nolus/nolusjs";
import { Lpp } from "@nolus/nolusjs/build/contracts";

export async function loadSuppliedAmount(this: Store) {
  const admin = useAdminStore();
  const walletAddress = this?.wallet?.address ?? WalletManager.getWalletAddress();
  const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
  const promises = [];
  const suppliedBalance: { [protocol: string]: string } = {};
  const lppPrice: { [protocol: string]: Dec } = {};

  for (const protocolKey in admin.contracts) {
    const fn = async () => {
      const protocol = admin.contracts![protocolKey];
      const lppClient = new Lpp(cosmWasmClient, protocol.lpp);

      const [depositBalance, price] = await Promise.all([
        lppClient.getLenderDeposit(walletAddress as string),
        lppClient.getPrice()
      ]);

      const p = new Dec(price.amount_quote.amount).quo(new Dec(price.amount.amount));
      suppliedBalance[protocolKey] = depositBalance.balance;
      lppPrice[protocolKey as string] = p;
    };

    promises.push(fn());
  }

  await Promise.all(promises);

  this.suppliedBalance = suppliedBalance;
  this.lppPrice = lppPrice;
}
