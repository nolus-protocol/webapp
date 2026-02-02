export const TWITTER_ACCOUNT = "https://twitter.com/NolusPlatform";
export const TELEGRAM_ACCOUNT = "https://t.me/NolusPlatform";
export const MEDIUM_ACCOUNT = "https://medium.com/nolusplatform";
export const REDDIT_ACCOUNT = "https://www.reddit.com/r/NolusPlatform";
export const LINKEDIN_ACCOUNT = "https://www.linkedin.com/company/nolus-platform";
export const DISCORD_ACCOUNT = "https://discord.com/invite/Rmwz8S6ZJP";
export const SUPPORT_URL = "https://hub.nolus.io";

// Intercom JWT token endpoint - uses backend instead of beacon
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
if (!BACKEND_URL) {
  throw new Error("VITE_BACKEND_URL environment variable is required");
}
export const INTERCOM_URL = `${BACKEND_URL}/api/intercom/hash`;

export enum APPEARANCE {
  light = "light",
  dark = "dark",
  sync = "sync"
}

export const CHART_RANGES = {
  "1": {
    label: "24h",
    days: "1"
  },
  "7": {
    label: "7d",
    days: "7"
  },
  "30": {
    label: "30d",
    days: "30"
  }
};

export const INTEREST_DECIMALS = 1;
export const PERMILLE = 1000;
export const PERCENT = 100;

export const UPDATE_BLOCK_INTERVAL = 1 * 60 * 1000;
export const UPDATE_REWARDS_INTERVAL = 60 * 1000;
export const SESSION_TIME = 25 * 60 * 1000;
export const UPDATE_LEASES = 10000;

export const UPDATE_BALANCE_INTERVAL = 8 * 1000;
export const UPDATE_PRICES_INTERVAL = 15 * 1000;

export const MONTHS = 12;

export const DECIMALS_AMOUNT = [
  {
    decimals: 2,
    amount: 10000
  },
  {
    decimals: 4,
    amount: 1000
  },
  {
    decimals: 6,
    amount: 100
  }
];

export const INTERCOM_API = "hbjifswh";
export const ZERO_DECIMALS = 6;
export const MAX_DECIMALS = 8;
export const MID_DECIMALS = 4;
export const NORMAL_DECIMALS = 2;

export const LedgerName = "Ledger";
export const WalletConnectName = "WalletConnect";
export const MetamaskName = "Metamask";
export const PhantomName = "Phantom";
export const SolflareName = "Solflare";

export const UNDELEGATE_DAYS = 21;
