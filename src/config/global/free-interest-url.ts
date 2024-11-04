import { isDev } from "./modes";

let url: string | Promise<string> = import("../lease/free-interest-assets.json?url").then((t) => t.default);

if (!isDev()) {
  url = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/free-interest-assets.json";
}

export const FREE_INTEREST_URL = url;
