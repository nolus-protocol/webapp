import type { Protocol, State } from "@/stores/admin/state";
import { defineStore } from "pinia";
import { AdminActionTypes } from "@/stores/admin/action-types";
import { NolusClient } from "@nolus/nolusjs";
import { Admin } from "@nolus/nolusjs/build/contracts";
import { CONTRACTS } from "@/config/contracts";
import { EnvNetworkUtils } from "@/utils";

const useAdminStore = defineStore("admin", {
  state: () => {
    return {
      protocols: {},
    } as State;
  },
  actions: {
    async [AdminActionTypes.GET_PROTOCOLS]() {
      try {
        const network = EnvNetworkUtils.getStoredNetworkName();

        if (this.protocols[network]) {
          return;
        }

        const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
        const adminInstance = CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].admin;
        const adminContract = new Admin(
          cosmWasmClient,
          adminInstance.instance
        );
        const protocols = (await adminContract.getProtocols()).filter((item) => {
          return !adminInstance.ignoreProtocols?.includes(item)
        });
        const promises = [];
        const protocolData: Protocol = {};

        for (const protocol of protocols) {
          const fn = async () => {
            const p = await adminContract.getProtocol(protocol);
            protocolData[p.network] = p.contracts;
          }
          promises.push(fn());
        }

        await Promise.all(promises);
        this.protocols[network] = protocolData;

      } catch (error: Error | any) {
        throw new Error(error);
      }
    },
  },
  getters: {
    contracts(state) {
      const network = EnvNetworkUtils.getStoredNetworkName();
      return state.protocols[network];
    },
  },
});

export { useAdminStore, AdminActionTypes };
