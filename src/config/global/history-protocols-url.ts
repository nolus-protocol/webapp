import { isDev } from "./modes";

let url: string | Promise<string> = import("../networks/history-protocols.json?url").then((t) => t.default);

if (!isDev()) {
  url = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/history-protocols.json";
}

export const HISTORY_PROTOCOLS_URL = url;
