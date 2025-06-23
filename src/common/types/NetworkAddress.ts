import type { IObjectKeys } from "@/common/types";

export interface NetworkAddress {
  chainName?: string;
  explorer: string;
  govern: string;
  staking: string;
  sendDefaultValue: string;
  endpoints: Promise<string> | string;
  etlApi: string;
  evmEndpoints: Promise<string> | string;
}
