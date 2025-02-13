import type { IObjectKeys } from "@/common/types";
import { NETWORK } from "@/config/global";
import { defaultRegistryTypes } from "@cosmjs/stargate";
import { Registry } from "@cosmjs/proto-signing";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { Any } from "cosmjs-types/google/protobuf/any";
import { Buffer } from "buffer";

const registry = new Registry(defaultRegistryTypes);
registry.register("/cosmwasm.wasm.v1.MsgExecuteContract", MsgExecuteContract);

export class EtlApi {
  static getApiUrl() {
    return NETWORK.etlApi;
  }

  static async fetchEarnApr(protocol: string): Promise<IObjectKeys> {
    return fetch(`${EtlApi.getApiUrl()}/earn-apr?protocol=${protocol}`).then((data) => data.json());
  }

  static async fetchLeaseOpening(leaseAddres: string): Promise<IObjectKeys> {
    return fetch(`${EtlApi.getApiUrl()}/ls-opening?lease=${leaseAddres}`).then((data) => data.json());
  }

  static async fetchPriceSeries(key: string, protocol: string, interval: string): Promise<[number, number][]> {
    return fetch(`${EtlApi.getApiUrl()}/prices?interval=${interval}&key=${key}&protocol=${protocol}`).then((data) =>
      data.json()
    );
  }

  static async fetchPnlOverTime(address: string, interval: string): Promise<{ amount: number; date: Date }[]> {
    return fetch(`${EtlApi.getApiUrl()}/pnl-over-time?interval=${interval}&address=${address}`).then((data) =>
      data.json()
    );
  }

  static async fetchTxVolume(): Promise<{ total_tx_value: string }> {
    return fetch(`${EtlApi.getApiUrl()}/total-tx-value`).then((data) => data.json());
  }
  static async fetchLeaseMonthly(): Promise<IObjectKeys[]> {
    return fetch(`${EtlApi.getApiUrl()}/leases-monthly`).then((data) => data.json());
  }

  static async fetchPNL(address: string, skip: number, limit: number): Promise<IObjectKeys[]> {
    return fetch(`${EtlApi.getApiUrl()}/ls-loan-closing?address=${address}&skip=${skip}&limit=${limit}`).then((data) =>
      data.json()
    );
  }

  static async fetchOpenPositionValue(): Promise<IObjectKeys> {
    return fetch(`${EtlApi.getApiUrl()}/open-position-value`).then((data) => data.json());
  }

  static async fetchOpenInterest(): Promise<IObjectKeys> {
    return fetch(`${EtlApi.getApiUrl()}/open-interest`).then((data) => data.json());
  }

  static async fetchUnrealizedPnl(): Promise<IObjectKeys> {
    return fetch(`${EtlApi.getApiUrl()}/unrealized-pnl`).then((data) => data.json());
  }

  static async fetchUnrealizedByAddressPnl(address: string): Promise<IObjectKeys> {
    return fetch(`${EtlApi.getApiUrl()}/unrealized-pnl-by-address?address=${address}`).then((data) => data.json());
  }

  static async fetchRealizedPNL(address: string): Promise<IObjectKeys> {
    return fetch(`${EtlApi.getApiUrl()}/realized-pnl?address=${address}`).then((data) => data.json());
  }

  static async fetchRealizedPNLStats(): Promise<IObjectKeys> {
    return fetch(`${EtlApi.getApiUrl()}/realized-pnl-stats`).then((data) => data.json());
  }

  static async fetchSuppliedFunds(): Promise<IObjectKeys> {
    return fetch(`${EtlApi.getApiUrl()}/supplied-funds`).then((data) => data.json());
  }

  static async fetchTimeSeries(): Promise<IObjectKeys[]> {
    return fetch(`${EtlApi.getApiUrl()}/time-series`).then((data) => data.json());
  }

  static async fetchTXS(address: string, skip: number, limit: number): Promise<IObjectKeys[]> {
    return fetch(`${EtlApi.getApiUrl()}/txs?address=${address}&skip=${skip}&limit=${limit}`).then(async (data) => {
      const items = await data.json();

      return items.map((item: IObjectKeys) => {
        item.timestamp = new Date(item.timestamp);
        const value = Uint8Array.from(Buffer.from(item.value, "base64"));
        const any = Any.fromPartial({ typeUrl: item.type, value });
        item.data = registry.decode(any);
        return item;
      });
    });
  }
}
