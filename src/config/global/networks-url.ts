import { isDev } from "./modes";

let url: string | Promise<string> = import("../networks/networks.json?url").then((t) => t.default);

if (!isDev()) {
  url = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/networks.json";
}

export const CHAIN_IDS_URLS = url;
