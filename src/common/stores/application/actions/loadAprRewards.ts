import type { Store } from "../types";
import { NolusClient } from "@nolus/nolusjs";
import { Treasury } from "@nolus/nolusjs/build/contracts";
import { useAdminStore } from "../../admin";
import { EnvNetworkUtils, EtlApi, Logger } from "@/common/utils";
import { CONTRACTS } from "@/config/global";
import { INTEREST_DECIMALS } from "@/config/global";

export async function loadAprRewards(this: Store) {
  try {
    const admin = useAdminStore();
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const dispatcherClient = new Treasury(
      cosmWasmClient,
      CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].dispatcher.instance
    );
    console.log(CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].dispatcher.instance);
    const apr: { [key: string]: number } = {};
    const promises = [
      dispatcherClient.calculateRewards().catch((e) => {
        console.log(e);
        return 40;
      })
    ];

    for (const protocolKey in admin.contracts) {
      const fn = async () => {
        const data = await EtlApi.fetchEarnApr(protocolKey).catch((e) => ({ earn_apr: 0 }));
        apr[protocolKey] = data.earn_apr;
        return data.earn_apr;
      };
      promises.push(fn());
    }

    const [dispatcherRewards] = await Promise.all(promises);
    this.apr = apr;
    this.dispatcherRewards = dispatcherRewards / Math.pow(10, INTEREST_DECIMALS);
  } catch (error) {
    Logger.error(error);
    return 40;
  }
}
