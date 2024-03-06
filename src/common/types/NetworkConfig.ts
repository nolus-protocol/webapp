import type { NetworkAddress } from "@/common/types";

export interface NetworkConfig {
  networkName: string;
  networkAddresses: NetworkAddress;
}

export interface Endpoint {
  [index: string]: Node | number | string;
  downtime: number;
  archive_node_rpc: string;
  archive_node_api: string;
}

export interface Node {
  primary: API;
  fallback: API[];
}

export interface API {
  rpc: string;
  api: string;
}

export interface ARCHIVE_NODE {
  archive_node_rpc: string;
  archive_node_api: string;
}

export interface Status {
  result: {
    sync_info: {
      latest_block_height: string;
      latest_block_time: string;
    };
  };
}

export enum NetworkTypes {
  cosmos = "cosmos",
  evm = "evm"
}
