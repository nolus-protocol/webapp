import { isServe } from "./modes";

let url: string | Promise<string> = import("../proposals/config.json?url").then((t) => t.default);

if (!isServe()) {
  url = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/proposals/config.json";
}

export const PROMOSALS_CONFIG_URL = url;
