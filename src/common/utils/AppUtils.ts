import type { API, ARCHIVE_NODE, Endpoint, Node, News, SkipRouteConfigType } from "@/common/types";

import { connectComet } from "@cosmjs/tendermint-rpc";
import { EnvNetworkUtils } from ".";
import { CONTRACTS, DOWNPAYMENT_RANGE_DEV, NEWS_URL, NEWS_WALLETS_PATH } from "@/config/global";
import { ChainConstants } from "@nolus/nolusjs";
import { SKIPROUTE_CONFIG_URL } from "@/config/global/swap";

import {
  DOWNPAYMENT_RANGE_URL,
  FREE_INTEREST_ADDRESS_URL,
  isDev,
  isServe,
  languages,
  NETWORKS,
  SWAP_FEE_URL
} from "@/config/global";

export class AppUtils {
  public static LANGUAGE = "language";
  public static BANNER = "banner";

  static downpaymentRange: Promise<{
    [key: string]: {
      min: number;
      max: number;
    };
  }>;

  static freeInterestAdress: Promise<{
    interest_paid_to: string[];
  }>;

  static news: Promise<News>;
  static skip_route_config: Promise<SkipRouteConfigType>;

  static swapFee: Promise<{
    [key: string]: number;
  }>;

  static rpc: {
    [key: string]: {
      [key: string]: Promise<API>;
    };
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

  static async getArchiveNodes() {
    const node = AppUtils.archive_node?.[EnvNetworkUtils.getStoredNetworkName()];

    if (node) {
      return node;
    }
    const archive = AppUtils.fetchArchiveNodes();
    AppUtils.archive_node[EnvNetworkUtils.getStoredNetworkName()] = archive;

    return archive;
  }

  static async getDownpaymentRange() {
    const downpaymentRange = AppUtils.downpaymentRange;

    if (downpaymentRange) {
      return downpaymentRange;
    }

    AppUtils.downpaymentRange = AppUtils.fetchDownpaymentRange();
    return AppUtils.downpaymentRange;
  }

  static async getSwapFee() {
    const swapFee = AppUtils.swapFee;

    if (swapFee) {
      return swapFee;
    }

    AppUtils.swapFee = AppUtils.fetchSwapFee();
    return AppUtils.swapFee;
  }

  static async getFreeInterestAddress() {
    const freeInterestAdress = AppUtils.freeInterestAdress;

    if (freeInterestAdress) {
      return freeInterestAdress;
    }

    AppUtils.freeInterestAdress = AppUtils.fetchFreeInterestAddress();
    return AppUtils.freeInterestAdress;
  }

  static async getNews() {
    if (this.news) {
      return this.news;
    }

    const news = AppUtils.fetchNews();
    this.news = news;
    return news;
  }

  static async getSkipRouteConfig() {
    if (this.skip_route_config) {
      return this.skip_route_config;
    }

    const skip_route_config = AppUtils.fetchSkipRoute();
    this.skip_route_config = skip_route_config;
    return skip_route_config;
  }

  static async getSingleNewAddresses(url = "") {
    try {
      if (!url.trim()) return [];

      const data = await fetch(`${NEWS_WALLETS_PATH}${url}`);
      const json = (await data.json()) as { addresses: string[] };

      return json.addresses;
    } catch (error) {
      return [];
    }
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
    const config = NETWORKS[EnvNetworkUtils.getStoredNetworkName()];
    const data = await fetch(await config.endpoints);
    const json = (await data.json()) as Endpoint;

    const archive = {
      archive_node_rpc: json.archive_node_rpc,
      archive_node_api: json.archive_node_api
    };

    return archive;
  }

  private static async fetch(network: string) {
    const config = NETWORKS[EnvNetworkUtils.getStoredNetworkName()];
    const data = await fetch(await config.endpoints);
    const json = (await data.json()) as Endpoint;
    const status = await AppUtils.fetchStatus((json[network] as Node).primary.rpc, json.downtime);

    if (status) {
      return (json[network] as Node).primary;
    }

    const networkData = AppUtils.fetchFallback(json[network] as Node, json.downtime);
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

  private static async fetchDownpaymentRange() {
    const data = await fetch(await DOWNPAYMENT_RANGE_URL);
    const json = (await data.json()) as {
      [key: string]: {
        min: number;
        max: number;
      };
    };

    if (isDev() || isServe()) {
      for (const key in json) {
        json[key].min = DOWNPAYMENT_RANGE_DEV;
      }
    }

    return json;
  }

  private static async fetchSwapFee() {
    const data = await fetch(await SWAP_FEE_URL);
    const json = (await data.json()) as {
      [key: string]: number;
    };

    return json;
  }

  private static async fetchFreeInterestAddress() {
    const data = await fetch(await FREE_INTEREST_ADDRESS_URL);
    const json = (await data.json()) as {
      interest_paid_to: string[];
    };

    return json;
  }

  private static async fetchNews() {
    const url = await NEWS_URL;
    const data = await fetch(url);
    const json = (await data.json()) as News;
    const n: News = {};

    for (const k in json) {
      if (AppUtils.getBanner(k)) {
        n[k] = json[k];
      }
    }

    return n;
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

  private static async fetchSkipRoute(): Promise<SkipRouteConfigType> {
    const url = await SKIPROUTE_CONFIG_URL;
    const data = await fetch(url);
    return data.json();
  }
}
