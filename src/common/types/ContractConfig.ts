import type { ContractInfo, ContractAdminInfo } from "@/common/types";

export interface ContractConfig {
  [key: string]: {
    protocols: Protocols;
    dispatcher: ContractInfo;
    admin: ContractAdminInfo;
  };
}

export interface Protocols {
  [key: string]: string;
}
