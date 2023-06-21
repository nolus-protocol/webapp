import { NETWORKS } from "@/config/env";
import { EnvNetworkUtils } from ".";
import type { Endpoint, Status, Node, API } from "@/types/NetworkConfig";

enum Mode {
    dev = 'dev',
    prod = 'prod'
}

export class ApptUtils {

    static rpc: {
        [key: string]: {
            [key: string]: Promise<API>
        }
    } = {};

    static isDev() {
        return import.meta.env.VITE_MODE == Mode.dev;
    }

    static async fetchEndpoints(network: string) {
        const net = ApptUtils.rpc?.[EnvNetworkUtils.getStoredNetworkName()]?.[network];

        if (net) {
            return net;
        }

        if(!ApptUtils.rpc[EnvNetworkUtils.getStoredNetworkName()]){
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
        const items = await fetch(`${rpc}/status`);
        const status = await items.json() as Status;
        const date = new Date(status.result.sync_info.latest_block_time);
        const now = new Date().getTime();
        const downtime = dtime * 1000;

        if ((now - date.getTime()) <= downtime) {
            return true;
        }

        return false;

    }

}