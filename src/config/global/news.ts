import { isServe } from "./modes";

let news: string | Promise<string> = import("../news/news.json?url").then((t) => t.default);
let newsWalletsPath: string = "/src/config/news/wallets/";

if (!isServe()) {
  news = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/news/news.json";
  newsWalletsPath = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/news/wallets/";
}

export const NEWS_URL = news;
export const NEWS_WALLETS_PATH = newsWalletsPath;
