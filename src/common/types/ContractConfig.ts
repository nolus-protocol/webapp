import type { ContractInfo, ContractAdminInfo, IObjectKeys } from "@/common/types";

export interface ContractConfig {
  [key: string]: {
    longDefault: string;
    protocols: Protocols;
    protocolConfig: IObjectKeys;
    dispatcher: ContractInfo;
    admin: ContractAdminInfo;
  };
}

export interface Protocols {
  [key: string]: string;
}
