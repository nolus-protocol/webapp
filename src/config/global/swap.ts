import { isDev } from "./modes";

let url: string | Promise<string> = import("../skiproute/config.json?url").then((t) => t.default);

if (!isDev()) {
  url = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/skiproute/config.json";
}

export const SKIPROUTE_CONFIG_URL = url;
