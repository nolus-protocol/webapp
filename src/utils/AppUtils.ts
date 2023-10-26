import { DOWNPAYMENT_RANGE_URL, FREE_INTEREST_ADDRESS_URL, NETWORKS, SWAP_FEE_URL, isDev, languages } from "@/config/env";
import { EnvNetworkUtils } from ".";
import type { Endpoint, Status, Node, API, ARCHIVE_NODE } from "@/types/NetworkConfig";

export class ApptUtils {

    public static LANGUAGE = "language";
    public static BANNER = "banner";

    static downpaymentRange: Promise<{
        [key: string]: {
            min: number,
            max: number
        }
    }>;

    static freeInterestAdress: Promise<{
        interest_paid_to: string[]
    }>;

    static swapFee: Promise<{
        [key: string]: number
    }>;

    static rpc: {
        [key: string]: {
            [key: string]: Promise<API>
        }
    } = {};


    static archive_node: {
        [key: string]: Promise<ARCHIVE_NODE>
    } = {};

    static isDev() {
        return isDev();
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

    public static setBannerInvisible() {
        localStorage.setItem(this.BANNER, '1');
    }

    static getBanner() {
        return !Number(localStorage.getItem(this.BANNER));
    }

    static async fetchEndpoints(network: string) {
        const net = ApptUtils.rpc?.[EnvNetworkUtils.getStoredNetworkName()]?.[network];
        
        if (net) {
            return net;
        }

        if (!ApptUtils.rpc[EnvNetworkUtils.getStoredNetworkName()]) {
            ApptUtils.rpc[EnvNetworkUtils.getStoredNetworkName()] = {};
        }

        const networkData = ApptUtils.fetch(network);
        ApptUtils.rpc[EnvNetworkUtils.getStoredNetworkName()][network] = networkData;
        return networkData;

    }

    static async getArchiveNodes() {
        const node = ApptUtils.archive_node?.[EnvNetworkUtils.getStoredNetworkName()];

        if (node) {
            return node;
        }        
        const archive = ApptUtils.fetchArchiveNodes();
        ApptUtils.archive_node[EnvNetworkUtils.getStoredNetworkName()] = archive;

        return archive;

    }

    private static async fetchArchiveNodes(): Promise<ARCHIVE_NODE> {
 
        const config = NETWORKS[EnvNetworkUtils.getStoredNetworkName()];
        const data = await fetch(config.endpoints);
        const json = await data.json() as Endpoint;

       const archive = {
            archive_node_rpc: json.archive_node_rpc,
            archive_node_api: json.archive_node_api
        };

        return archive;

    }
    

    private static async fetch(network: string) {
        const config = NETWORKS[EnvNetworkUtils.getStoredNetworkName()];
        const data = await fetch(config.endpoints);
        const json = await data.json() as Endpoint;
        const status = await ApptUtils.fetchStatus((json[network] as Node).primary.rpc, json.downtime);

        if (status) {
            return (json[network] as Node).primary;
        }

        const networkData = ApptUtils.fetchFallback(json[network] as Node, json.downtime);
        return networkData;

    }

    private static async fetchFallback(node: Node, downtime: number): Promise<API> {
        const item = (node as Node).fallback.shift();

        if (!item) {
            return node.primary;
        }

        const status = await ApptUtils.fetchStatus(item.rpc, downtime);

        if (status) {
            return item;
        }

        return ApptUtils.fetchFallback(node as Node, downtime);

    }

    private static async fetchStatus(rpc: string, dtime: number) {
        try {
            const items = await fetch(`${rpc}/status`);

            if (!items.ok) {
                return false;
            }

            const status = await items.json() as Status;
            const date = new Date(status.result.sync_info.latest_block_time);
            const now = new Date().getTime();
            const downtime = dtime * 1000;

            if ((now - date.getTime()) <= downtime) {
                return true;
            }
        } catch (error) {
            return false
        }

        return false;

    }

    static async getDownpaymentRange() {
        const downpaymentRange = ApptUtils.downpaymentRange;

        if (downpaymentRange) {
            return downpaymentRange;
        }


        ApptUtils.downpaymentRange = ApptUtils.fetchDownpaymentRange();
        return ApptUtils.downpaymentRange;

    }

    private static async fetchDownpaymentRange() {
        const data = await fetch(DOWNPAYMENT_RANGE_URL);
        const json = await data.json() as {
            [key: string]: {
                min: number,
                max: number
            }
        };

        return json;
    }

    static async getSwapFee() {
        const swapFee = ApptUtils.swapFee;

        if (swapFee) {
            return swapFee;
        }

        ApptUtils.swapFee = ApptUtils.fetchSwapFee();
        return ApptUtils.swapFee;

    }

    private static async fetchSwapFee() {
        const data = await fetch(SWAP_FEE_URL);
        const json = await data.json() as {
            [key: string]: number
        };

        return json;
    }

    static async getFreeInterestAddress() {
        const freeInterestAdress = ApptUtils.freeInterestAdress;

        if (freeInterestAdress) {
            return freeInterestAdress;
        }

        ApptUtils.freeInterestAdress = ApptUtils.fetchFreeInterestAddress();
        return ApptUtils.freeInterestAdress;

    }

    private static async fetchFreeInterestAddress() {
        const data = await fetch(FREE_INTEREST_ADDRESS_URL);
        const json = await data.json() as {
            interest_paid_to: string[]
        };

        return json;
    }

}