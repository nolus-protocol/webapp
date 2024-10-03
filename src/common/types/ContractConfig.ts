import type { ContractInfo, ContractAdminInfo, IObjectKeys } from "@/common/types";

export interface ContractConfig {
  [key: string]: {
    mapPrices?: string;
    longDefault: string;
    protocols: Protocols;
    protocolConfig: IObjectKeys;
    dispatcher: ContractInfo;
    admin: ContractAdminInfo;
    ignoreProtocolsInEarn: string[];
  };
}

export interface Protocols {
  [key: string]: string;
}
