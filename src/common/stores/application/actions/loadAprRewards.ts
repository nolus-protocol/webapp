import type { Store } from "../types";
import { NolusClient } from "@nolus/nolusjs";
import { Treasury } from "@nolus/nolusjs/build/contracts";
import { EnvNetworkUtils, EtlApi, Logger } from "@/common/utils";
import { CONTRACTS } from "@/config/global";
import { INTEREST_DECIMALS } from "@/config/global";

export async function loadAprRewards(this: Store) {
  try {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const dispatcherClient = new Treasury(
      cosmWasmClient,
      CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].dispatcher.instance
    );
    const apr: { [key: string]: number } = {};
    const promises = [dispatcherClient.calculateRewards().catch((e) => 40)];
    const data = await EtlApi.fetchPools();

    for (const p of data.protocols) {
      apr[p.protocol] = p.earn_apr;
    }

    const [dispatcherRewards] = await Promise.all(promises);
    this.apr = apr;
    this.dispatcherRewards = dispatcherRewards / Math.pow(10, INTEREST_DECIMALS);
  } catch (error) {
    Logger.error(error);
    return 40;
  }
}
