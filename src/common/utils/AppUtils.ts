import type { API, ARCHIVE_NODE, Endpoint, Node, SkipRouteConfigType, ProposalsConfigType } from "@/common/types";

import { connectComet } from "@cosmjs/tendermint-rpc";
import { EnvNetworkUtils } from ".";
import {
  CONTRACTS,
  DOWNPAYMENT_RANGE_DEV,
  IGNORE_DOWNPAYMENT_ASSETS_URL,
  IGNORE_LEASE_ASSETS_URL,
  IGNORE_ASSETS_URL
} from "@/config/global";
import { ChainConstants } from "@nolus/nolusjs";
import { SKIPROUTE_CONFIG_URL } from "@/config/global/swap";

import { DOWNPAYMENT_RANGE_URL, FREE_INTEREST_ADDRESS_URL, isDev, isServe, languages, NETWORK } from "@/config/global";
import { PROMOSALS_CONFIG_URL } from "@/config/global/proposals";
import { FREE_INTEREST_URL } from "@/config/global/free-interest-url";
import { DUE_PROJECTION_SECS_URL } from "@/config/global/due-projection-secs-url";
import { CHAIN_IDS_URLS } from "@/config/global/chainids-url";

export class AppUtils {
  public static LANGUAGE = "language";
  public static BANNER = "banner";

  static downpaymentRange: {
    [key: string]: Promise<{
      [key: string]: {
        min: number;
        max: number;
      };
    }>;
  } = {};

  static freeInterestAdress: Promise<{
    interest_paid_to: string[];
  }>;

  static skip_route_config: Promise<SkipRouteConfigType>;
  static proposals_config: Promise<ProposalsConfigType>;

  static swapFee: Promise<{
    [key: string]: number;
  }>;

  static freeInterest: Promise<string[]>;
  static dueProjectionSecs: Promise<{
    due_projection_secs: number;
  }>;
  static ignoreLeaseAssets: Promise<string[]>;
  static ignoreDownpaymentAssets: Promise<string[]>;
  static ignoreAssets: Promise<string[]>;

  static rpc: {
    [key: string]: {
      [key: string]: Promise<API>;
    };
  } = {};

  static chainIds: Promise<{
    [key: string]: {
      [key: string]: string;
    };
  }>;

  static evmRpc: {
    [key: string]: Promise<API>;
  } = {};

  static archive_node: {
    [key: string]: Promise<ARCHIVE_NODE>;
  } = {};

  static isDev() {
    return isDev();
  }

  static isServe() {
    return isServe();
  }

  public static setLang(lang: string) {
    localStorage.setItem(this.LANGUAGE, lang);
  }

  static getLang() {
    const theme = localStorage.getItem(this.LANGUAGE);
    const items = Object.keys(languages);
    if (items.includes(theme as string)) {
      return languages[theme as keyof typeof languages];
    }
    return languages.en;
  }

  public static setBannerInvisible(key: string) {
    localStorage.setItem(`${this.BANNER}-${key}`, "1");
  }

  static getBanner(key: string) {
    return !Number(localStorage.getItem(`${this.BANNER}-${key}`));
  }

  static async fetchEndpoints(network: string) {
    const net = AppUtils.rpc?.[EnvNetworkUtils.getStoredNetworkName()]?.[network];
    if (net) {
      return net;
    }

    if (!AppUtils.rpc[EnvNetworkUtils.getStoredNetworkName()]) {
      AppUtils.rpc[EnvNetworkUtils.getStoredNetworkName()] = {};
    }

    const networkData = AppUtils.fetch(network);
    AppUtils.rpc[EnvNetworkUtils.getStoredNetworkName()][network] = networkData;
    return networkData;
  }

  static async fetchEvmEndpoints(network: string) {
    const net = AppUtils.evmRpc?.[network];

    if (net) {
      return net;
    }

    if (!AppUtils.evmRpc) {
      AppUtils.evmRpc = {};
    }

    const networkData = AppUtils.fetchEvmRpc(network);
    AppUtils.evmRpc[network] = networkData;
    return networkData;
  }

  static async getArchiveNodes() {
    const node = AppUtils.archive_node?.[EnvNetworkUtils.getStoredNetworkName()];

    if (node) {
      return node;
    }
    const archive = AppUtils.fetchArchiveNodes();
    AppUtils.archive_node[EnvNetworkUtils.getStoredNetworkName()] = archive;

    return archive;
  }

  static async getDownpaymentRange(protocol: string) {
    const downpaymentRange = AppUtils.downpaymentRange[protocol];

    if (downpaymentRange) {
      return downpaymentRange;
    }

    AppUtils.downpaymentRange = { [protocol]: AppUtils.fetchDownpaymentRange(protocol) };
    return AppUtils.downpaymentRange[protocol];
  }

  static async getFreeInterest() {
    const freeInterest = AppUtils.freeInterest;

    if (freeInterest) {
      return freeInterest;
    }

    AppUtils.freeInterest = AppUtils.fetchFreeInterest();
    return AppUtils.freeInterest;
  }

  static async getDueProjectionSecs() {
    const dueProjectionSecs = AppUtils.dueProjectionSecs;

    if (dueProjectionSecs) {
      return dueProjectionSecs;
    }

    AppUtils.dueProjectionSecs = AppUtils.fetchDueProjectionSecs();
    return AppUtils.dueProjectionSecs;
  }

  static async getFreeInterestAddress() {
    const freeInterestAdress = AppUtils.freeInterestAdress;

    if (freeInterestAdress) {
      return freeInterestAdress;
    }

    AppUtils.freeInterestAdress = AppUtils.fetchFreeInterestAddress();
    return AppUtils.freeInterestAdress;
  }

  static async getIgnoreLeaseAssets() {
    const ignoreLeaseAssets = AppUtils.ignoreLeaseAssets;

    if (ignoreLeaseAssets) {
      return ignoreLeaseAssets;
    }

    AppUtils.ignoreLeaseAssets = AppUtils.fetchIgnoreLeaseAssets();
    return AppUtils.ignoreLeaseAssets;
  }

  static async getIgnoreDownpaymentAssets() {
    const ignoreDownpaymentAssets = AppUtils.ignoreDownpaymentAssets;

    if (ignoreDownpaymentAssets) {
      return ignoreDownpaymentAssets;
    }

    AppUtils.ignoreDownpaymentAssets = AppUtils.fetchIgnoreDownpaymentAssets();
    return AppUtils.ignoreDownpaymentAssets;
  }

  static async getIgnoreAssets() {
    const ignoreAssets = AppUtils.ignoreAssets;

    if (ignoreAssets) {
      return ignoreAssets;
    }

    AppUtils.ignoreAssets = AppUtils.fetchIgnoreAssets();
    return AppUtils.ignoreAssets;
  }

  static async getSkipRouteConfig() {
    if (this.skip_route_config) {
      return this.skip_route_config;
    }

    const skip_route_config = AppUtils.fetchSkipRoute();
    this.skip_route_config = skip_route_config;
    return skip_route_config;
  }

  static async getProposalsConfig() {
    if (this.proposals_config) {
      return this.proposals_config;
    }

    const proposals_config = AppUtils.fetchProposalsConfigRoute();
    this.proposals_config = proposals_config;
    return proposals_config;
  }

  static async getChainIds() {
    if (this.chainIds) {
      return this.chainIds;
    }

    const chainIds = AppUtils.fetchChainIds();
    this.chainIds = chainIds;
    return chainIds;
  }

  public static getProtocols() {
    return CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].protocols;
  }

  public static getDefaultProtocol() {
    switch (EnvNetworkUtils.getStoredNetworkName()) {
      case "mainnet": {
        return AppUtils.getProtocols().osmosis_noble;
      }
      case "testnet": {
        return AppUtils.getProtocols().osmosis;
      }
      default: {
        return AppUtils.getProtocols().osmosis_noble;
      }
    }
  }

  private static async fetchArchiveNodes(): Promise<ARCHIVE_NODE> {
    const config = NETWORK;
    const data = await fetch(await config.endpoints);
    const json = (await data.json()) as Endpoint;

    const archive = {
      archive_node_rpc: json.archive_node_rpc,
      archive_node_api: json.archive_node_api
    };

    return archive;
  }

  private static async fetch(network: string) {
    const config = NETWORK;
    const data = await fetch(await config.endpoints);
    const json = (await data.json()) as Endpoint;
    const status = await AppUtils.fetchStatus((json[network] as Node).primary.rpc, json.downtime);

    if (status) {
      return (json[network] as Node).primary;
    }

    const networkData = AppUtils.fetchFallback(json[network] as Node, json.downtime);
    return networkData;
  }

  private static async fetchEvmRpc(network: string) {
    const config = NETWORK;
    const data = await fetch(await config.evmEndpoints);
    const json = (await data.json()) as Endpoint;
    const status = await AppUtils.fetchEvmStatus((json[network] as Node).primary.rpc);

    if (status) {
      return (json[network] as Node).primary;
    }

    const networkData = AppUtils.fetchEvmFallback(json[network] as Node);
    return networkData;
  }

  private static async fetchFallback(node: Node, downtime: number): Promise<API> {
    const item = (node as Node).fallback.shift();

    if (!item) {
      return node.primary;
    }

    const status = await AppUtils.fetchStatus(item.rpc, downtime);

    if (status) {
      return item;
    }

    return AppUtils.fetchFallback(node as Node, downtime);
  }

  private static async fetchEvmFallback(node: Node): Promise<API> {
    const item = (node as Node).fallback.shift();

    if (!item) {
      return node.primary;
    }

    const status = await AppUtils.fetchEvmStatus(item.rpc);

    if (status) {
      return item;
    }

    return AppUtils.fetchEvmFallback(node as Node);
  }

  private static async fetchStatus(rpc: string, dtime: number) {
    try {
      const client = await connectComet(rpc);
      const status = await client.status();
      const date = status.syncInfo.latestBlockTime;
      const now = new Date().getTime();
      const downtime = dtime * 1000;

      if (now - date.getTime() <= downtime) {
        client.disconnect();
        return true;
      }
    } catch (error) {
      return false;
    }

    return false;
  }

  private static async fetchEvmStatus(rpc: string) {
    try {
      const data = await fetch(rpc, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ method: "eth_syncing", params: [], id: 1, jsonrpc: "2.0" })
      });
      const json = await data.json();
      return !json.result;
    } catch (error) {
      return false;
    }
  }

  private static async fetchDownpaymentRange(protocol: string) {
    const data = await fetch(DOWNPAYMENT_RANGE_URL(protocol));
    const json = (await data.json()) as {
      [key: string]: {
        min: number;
        max: number;
      };
    };

    if (isDev()) {
      for (const key in json) {
        json[key].min = DOWNPAYMENT_RANGE_DEV;
      }
    }

    return json;
  }

  private static async fetchFreeInterestAddress() {
    const data = await fetch(await FREE_INTEREST_ADDRESS_URL);
    const json = (await data.json()) as {
      interest_paid_to: string[];
    };

    return json;
  }

  public static async fetchNetworkStatus() {
    const rpc = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;
    const data = await fetch(`${rpc}/status`);
    const json = (await data.json()) as {
      result: {
        node_info: {
          network: string;
        };
      };
    };

    return json;
  }

  private static async fetchChainIds(): Promise<{
    [key: string]: {
      [key: string]: string;
    };
  }> {
    const url = await CHAIN_IDS_URLS;
    const data = await fetch(url);
    return data.json();
  }

  private static async fetchSkipRoute(): Promise<SkipRouteConfigType> {
    const url = await SKIPROUTE_CONFIG_URL;
    const data = await fetch(url);
    return data.json();
  }

  private static async fetchProposalsConfigRoute(): Promise<ProposalsConfigType> {
    const url = await PROMOSALS_CONFIG_URL;
    const data = await fetch(url);
    return data.json();
  }

  private static async fetchFreeInterest() {
    const data = await fetch(await FREE_INTEREST_URL);
    const json = (await data.json()) as string[];

    return json;
  }

  private static async fetchDueProjectionSecs() {
    const data = await fetch(await DUE_PROJECTION_SECS_URL);
    const json = (await data.json()) as { due_projection_secs: number };

    return json;
  }

  private static async fetchIgnoreLeaseAssets() {
    const data = await fetch(await IGNORE_LEASE_ASSETS_URL);
    const json = (await data.json()) as string[];

    return json;
  }

  private static async fetchIgnoreDownpaymentAssets() {
    const data = await fetch(await IGNORE_DOWNPAYMENT_ASSETS_URL);
    const json = (await data.json()) as string[];

    return json;
  }

  private static async fetchIgnoreAssets() {
    const data = await fetch(await IGNORE_ASSETS_URL);
    const json = (await data.json()) as string[];

    return json;
  }
}
