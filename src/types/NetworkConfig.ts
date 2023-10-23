import type { NetworkAddress } from "@/types";

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
  primary: API,
  fallback: API[]
}

export interface API {
  rpc: string;
  api: string;
}

export interface Status {
  result: {
    sync_info: {
      latest_block_height: string;
      latest_block_time: string;
    };
  }
}