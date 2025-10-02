import type { Protocol, Store } from "@/common/stores/admin/types";
import { AppUtils, EnvNetworkUtils } from "@/common/utils";
import { NolusClient } from "@nolus/nolusjs";
import { CONTRACTS } from "@/config/global";
import { Admin } from "@nolus/nolusjs/build/contracts";

export async function getProtocols(this: Store) {
  try {
    const network = EnvNetworkUtils.getStoredNetworkName();

    if (this.protocols[network]) {
      return;
    }

    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
    const adminInstance = CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].admin;
    const adminContract = new Admin(cosmWasmClient, adminInstance.instance);

    const protocols = (await adminContract.getProtocols()).filter((item) => {
      return !adminInstance.ignoreProtocols?.includes(item);
    });

    const promises = [];
    const protocolData: Protocol = {};

    for (const protocol of protocols) {
      const fn = async () => {
        const p = await adminContract.getProtocol(protocol);
        protocolData[protocol] = p.contracts;
      };
      promises.push(fn());
    }

    const [_data, historyProtocols] = await Promise.all([Promise.all(promises), AppUtils.getHistoryProtocols()]);
    this.protocols[network] = protocolData;
    this.history_protocols = historyProtocols;
  } catch (error: Error | any) {
    throw new Error(error);
  }
}
