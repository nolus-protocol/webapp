import type { Protocol, Store } from "@/common/stores/admin/types";
import { EnvNetworkUtils } from "@/common/utils";
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
      return true;
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

    await Promise.all(promises);
    this.protocols[network] = protocolData;
  } catch (error: Error | any) {
    throw new Error(error);
  }
}
