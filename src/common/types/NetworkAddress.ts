import type { NetworkData } from "@nolus/nolusjs/build/types/Networks";
import type { IObjectKeys } from "@/common/types";

export interface NetworkAddress {
  chainName?: string;
  explorer: string;
  govern: string;
  staking: string;
  sendDefaultValue: string;
  endpoints: Promise<string> | string;
  currencies: () => Promise<NetworkData | IObjectKeys>;
  etlApi: string;
  evmEndpoints: Promise<string> | string;
}
