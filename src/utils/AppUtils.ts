import { NETWORKS, isDev, languages } from "@/config/env";
import { EnvNetworkUtils } from ".";
import type { Endpoint, Status, Node, API } from "@/types/NetworkConfig";

export class ApptUtils {

    public static LANGUAGE = "language";

    static rpc: {
        [key: string]: {
            [key: string]: Promise<API>
        }
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

}