import type { NetworkData } from "@nolus/nolusjs/build/types/Networks";
import type { IObjectKeys } from "@/common/types";

export interface NetworkAddress {
  chainName?: string;
  explorer: string;
  govern: string;
  staking: string;
  endpoints: Promise<string> | string;
  currencies: () => Promise<NetworkData | IObjectKeys>;
  etlApi: string;
  leaseBlockUpdate: number;
  lppCreatedAt: number;
  evmEndpoints: Promise<string> | string;
}
