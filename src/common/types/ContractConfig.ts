import type { ContractInfo, ContractAdminInfo, IObjectKeys } from "@/common/types";

export interface ContractConfig {
  [key: string]: {
    mapPrices?: string;
    protocols: Protocols;
    protocolConfig: IObjectKeys;
    dispatcher: ContractInfo;
    admin: ContractAdminInfo;
    ignoreProtocolsInEarn: string[];
    protocolsFilter: {
      [key: string]: {
        short: boolean;
        key: string;
        name: string;
        native: string;
        image: string;
        hold: string[];
        disabled?: boolean;
      };
    };
  };
}

export interface Protocols {
  [key: string]: string;
}
