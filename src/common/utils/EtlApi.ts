import type { IObjectKeys } from "@/common/types";
import { NETWORKS } from "@/config/global";
import { EnvNetworkUtils } from ".";

export class EtlApi {
  static getApiUrl() {
    return NETWORKS[EnvNetworkUtils.getStoredNetworkName()].etlApi;
  }

  static async fetchEarnApr(protocol: string): Promise<IObjectKeys> {
    return fetch(`${EtlApi.getApiUrl()}/earn-apr?protocol=${protocol}`).then((data) => data.json());
  }

  static async fetchLeaseOpening(leaseAddres: string): Promise<IObjectKeys> {
    return fetch(`${EtlApi.getApiUrl()}/ls-opening?lease=${leaseAddres}`).then((data) => data.json());
  }

  static async fetchPriceSeries(key: string, protocol: string, interval: string): Promise<IObjectKeys> {
    return fetch(`${EtlApi.getApiUrl()}/prices?interval=${interval}&key=${key}&protocol=${protocol}`).then((data) =>
      data.json()
    );
  }
}
