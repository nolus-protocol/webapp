import { isDev } from "./modes";

let url: string | Promise<string> = import("../networks/currencies.json?url").then((t) => t.default);

if (!isDev()) {
  url = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/currencies.json";
}

export const CURRENCIES_URL = url;
