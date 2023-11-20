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
  }
}

export interface SquiRouterNetwork {
  key: string,
  label: string
  chainId: string
  symbol: string
  native: boolean,
  estimation: {
    duration: number,
    type: string
  }
}

export interface SquiRouterNetworkProp  extends SquiRouterNetwork{
  value: string
}

export enum NetworkTypes{
  cosmos = 'cosmos',
  emv = 'emv'
}