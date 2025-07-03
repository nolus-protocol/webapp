import { isDev } from "./modes";

let url: string | Promise<string> = import("../networks/history-currencies.json?url").then((t) => t.default);

if (!isDev()) {
  url = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/history-currencies.json";
}

export const HISTORY_CURRENCIES_URL = url;
