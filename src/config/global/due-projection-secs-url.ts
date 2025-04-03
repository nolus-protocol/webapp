import { isDev } from "./modes";

let url: string | Promise<string> = import("../lease/due-projection-secs?url").then((t) => t.default);

if (!isDev()) {
  url = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/due-projection-secs";
}

export const DUE_PROJECTION_SECS_URL = url;
