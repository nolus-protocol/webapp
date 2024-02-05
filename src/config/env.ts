import type { NetworkAddress } from "@/types";
import { Dec } from "@keplr-wallet/unit";
import nlsIcon from "@/assets/icons/coins/nls.svg";

export const DEFAULT_PRIMARY_NETWORK = "mainnet";

export const NETWORKS: { [key: string]: NetworkAddress } = {
  localnet: {
    currencies: () => import("@nolus/nolusjs/build/utils/currencies_devnet.json"),
    endpoints:
      "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/vitosha-endpoints.json",
    explorer: "https://testnet.ping.pub/nolus/tx",
    govern: "https://testnet.ping.pub/nolus/gov",
    staking: "https://testnet.ping.pub/nolus/staking",
    leaseBlockUpdate: 977014,
    lppCreatedAt: 0,
    web3auth: {
      clientId: "BHPGnOodSp4t0ZDuuJ3suCZCtwVILYmfOTbDrzlUKK6ADFrNMWg563MAMj_CBW8sDVvg3BqJi8i284t6o",
      network: "testnet",
      google: {
        name: "Nolus",
        verifier: "nolusprotocol",
        typeOfLogin: "google",
        clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com"
      }
    }
  },
  devnet: {
    currencies: () => import("@nolus/nolusjs/build/utils/currencies_devnet.json"),
    endpoints:
      "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/vitosha-endpoints.json",
    explorer: "https://testnet.ping.pub/nolus/tx",
    govern: "https://testnet.ping.pub/nolus/gov",
    staking: "https://testnet.ping.pub/nolus/staking",
    leaseBlockUpdate: 1072220,
    lppCreatedAt: 1696843049941,
    web3auth: {
      clientId:
        "BHYXk3KjVtoSMkmePippWgXv3vbgJnXnsORt9G4maaPsqNqcbK_TPF5WC6oPIm8xVaM21iHRRjUl0JhHft4ZgqY",
      network: "cyan",
      google: {
        name: "Nolus",
        verifier: "nolusprotocol",
        typeOfLogin: "google",
        clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com"
      }
    }
  },
  testnet: {
    currencies: () => import("@nolus/nolusjs/build/utils/currencies_testnet.json"),
    endpoints:
      "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/rila-endpoints.json",
    chainName: "Nolus Testnet",
    explorer: "https://testnet.ping.pub/nolus/tx",
    govern: "https://testnet.ping.pub/nolus/gov",
    staking: "https://testnet.ping.pub/nolus/staking",
    leaseBlockUpdate: 977014,
    lppCreatedAt: 1686573237831,
    web3auth: {
      clientId:
        "BHYXk3KjVtoSMkmePippWgXv3vbgJnXnsORt9G4maaPsqNqcbK_TPF5WC6oPIm8xVaM21iHRRjUl0JhHft4ZgqY",
      network: "cyan",
      google: {
        name: "Nolus",
        verifier: "nolusprotocol",
        typeOfLogin: "google",
        clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com"
      }
    }
  },
  mainnet: {
    currencies: () => import("@nolus/nolusjs/build/utils/currencies_mainnet.json"),
    endpoints:
      "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/pirin-endpoints.json",
    chainName: "Nolus",
    explorer: "https://ping.pub/nolus/tx",
    govern: "https://ping.pub/nolus/gov",
    staking: "https://ping.pub/nolus/staking",
    leaseBlockUpdate: 1029833,
    lppCreatedAt: 1686845698269,
    web3auth: {
      clientId:
        "BHYXk3KjVtoSMkmePippWgXv3vbgJnXnsORt9G4maaPsqNqcbK_TPF5WC6oPIm8xVaM21iHRRjUl0JhHft4ZgqY",
      network: "cyan",
      google: {
        name: "Nolus",
        verifier: "nolusprotocol",
        typeOfLogin: "google",
        clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com"
      }
    }
  }
};

export const NATIVE_CURRENCY = {
  currency: "usd",
  symbol: "$",
  locale: "en-US",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
};

export const NATIVE_ASSET = {
  ticker: "NLS",
  label: "NLS",
  value: "NLS",
  denom: "unls",
  icon: nlsIcon
};

export const NATIVE_NETWORK = {
  prefix: "nolus",
  value: "nls",
  label: "Nolus",
  native: true,
  estimation: 6,
  longOperationsEstimation: 20,
  leaseOpenEstimation: 2,
  leaseRepayEstimation: 1,
  key: "NOLUS",
  symbol: "NLS"
};

export enum SOURCE_PORTS {
  TRANSFER = "transfer"
}

export enum SNACKBAR {
  Queued = "queued",
  Success = "success",
  Error = "error"
}

export enum Mode {
  serve = "serve",
  dev = "dev",
  prod = "prod"
}

export const GAS_FEES = {
  create_vesting_account: 10000,
  delegation: 15000,
  undelegation: 20000,
  withdraw_delegator_reward: 15000,
  lender_deposit: 1000,
  lender_burn_deposit: 1200,
  lender_claim_rewards: 17000,
  transfer_amount: 500,
  open_lease: 5000,
  close_lease: 5000,
  repay_lease: 5000,
  market_close_lease: 5000,
  swap_amount: 5000,
  vote: 70000
};

export enum APPEARANCE {
  light = "light",
  dark = "dark",
  sync = "sync"
}

export const UPDATE_BLOCK_INTERVAL = 5 * 60 * 1000;
export const UPDATE_BALANCE_INTERVAL = 5 * 60 * 1000;
export const UPDATE_PRICES_INTERVAL = 5 * 60 * 1000;
export const UPDATE_REWARDS_INTERVAL = 5 * 60 * 1000;

export const DEFAULT_LEASE_UP_PERCENT = "150.00";
export const LEASE_UP_COEFICIENT = 1.5;
export const DEFAULT_APR = "24.34";
export const STAKING = {
  VALIDATORS_NUMBER: 2,
  SLASHED_DAYS: 30 * 24 * 60 * 60 * 1000,
  PERCENT: 0.05,
  SLICE: 3
};

export const TIP = {
  amount: 100,
  denom: NATIVE_ASSET.denom
};

export const INTEREST_DECIMALS = 1;
export const PERMILLE = 1000;
export const PERCENT = 100;

export const WASM_EVENTS = {
  "wasm-ls-request-loan": {
    key: "wasm-ls-request-loan",
    index: 0
  }
};

export const LIQUIDATION = new Dec(0.9);
export const calculateLiquidation = (unit: Dec, price: Dec) => {
  return unit.quo(price).quo(LIQUIDATION);
};

export const POSITIONS = 5;
export const MIN_POSITION = 25;
export const MAX_POSITION = 150;
export const DEFAULT_LTD = 1.5;
export const WASM_LP_DEPOSIT = "wasm-lp-deposit";
export const WASM_LP_OPEN = "wasm-ls-open";

export const INPUT_VALUES = [25, 50, 75, 100];
export const LPN_PRICE = 1;
export const LPN_DECIMALS = 6;
export const LPN_Symbol = "USDC.axl";
export const LPN_Ticker = "USDC_AXELAR";

export const SESSION_TIME = 15 * 60 * 1000;

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

export enum ErrorCodes {
  GasError = 11
}

export const MONTHS = 12;

export const calculateAditionalDebt = (principal: Dec, percent: Dec) => {
  const annualAmount = principal.mul(percent);
  const secondsAmount = annualAmount.quo(new Dec(31536000));
  const amountForTwoMinuts = secondsAmount.mul(new Dec(180));
  return amountForTwoMinuts;
};
console.log(import.meta.env)
export const isDev = () => {
  return import.meta.env.VITE_MODE == Mode.dev;
};

export const isServe = () => {
  return import.meta.env.VITE_MODE == Mode.serve;
};

export const CoinGecko = {
  url: "https://pro-api.coingecko.com/api/v3",
  label: "Nolus App",
  key: "CG-QQSfXqT6EJWXG9UjjfhfoJVk"
};

let l: {
  [key: string]: {
    key: string;
    label: string;
    url: string | Promise<string>;
  };
} = {
  en: {
    key: "en",
    label: "English",
    url: import("../locales/en.json?url").then((t) => t.default)
  },
  ru: {
    key: "ru",
    label: "Русский",
    url: import("../locales/ru.json?url").then((t) => t.default)
  },
  cn: {
    key: "cn",
    label: "中文",
    url: import("../locales/cn.json?url").then((t) => t.default)
  },
  fr: {
    key: "fr",
    label: "Français",
    url: import("../locales/fr.json?url").then((t) => t.default)
  },
  es: {
    key: "es",
    label: "Español",
    url: import("../locales/es.json?url").then((t) => t.default)
  },
  gr: {
    key: "gr",
    label: "Ελληνικά",
    url: import("../locales/gr.json?url").then((t) => t.default)
  },
  tr: {
    key: "tr",
    label: "Türkçe",
    url: import("../locales/tr.json?url").then((t) => t.default)
  },
  id: {
    key: "id",
    label: "Bahasa Indo",
    url: import("../locales/id.json?url").then((t) => t.default)
  }
};

if (!isServe()) {
  l = {
    en: {
      key: "en",
      label: "English",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/en.json"
    },
    ru: {
      key: "ru",
      label: "Русский",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/ru.json"
    },
    cn: {
      key: "cn",
      label: "中文",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/cn.json"
    },
    es: {
      key: "es",
      label: "Español",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/es.json"
    },
    gr: {
      key: "gr",
      label: "Ελληνικά",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/gr.json"
    },
    tr: {
      key: "tr",
      label: "Türkçe",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/tr.json"
    },
    fr: {
      key: "fr",
      label: "Français",
      url: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/locales/fr.json"
    }
  };
}

const filament = {
  token: "1328330b-c9aa-46bd-aaf0-3330337f5400",
  url: "https://auxo.staging.numia.xyz/track"
};

export const SquidRouter = {
  integratorId: "nolus-sdk",
  baseUrl: "https://api.squidrouter.com",
  networks: {
    localnet: import("./squidrouter/vitosha-networks.json?url").then((t) => t.default),
    devnet: import("./squidrouter/vitosha-networks.json?url").then((t) => t.default),
    testnet: import("./squidrouter/rila-networks.json?url").then((t) => t.default),
    mainnet: import("./squidrouter/pirin-networks.json?url").then((t) => t.default)
  }
};

export const getPrice = async (token: string) => {
  return fetch(
    `${CoinGecko.url}/simple/price?ids=${token}&vs_currencies=usd&x_cg_pro_api_key=${CoinGecko.key}`
  ).then((res) => res.json());
};

let news: string | Promise<string> = import("./news/news.json?url").then((t) => t.default);
let newsWalletsPath: string = "/src/config/news/wallets/";

if (!isServe()) {
  news =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/news/news.json";
  newsWalletsPath =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/news/wallets/";
}

export const minimumLeaseAmount = 1;
export const languages = l;
export const SUPPORTED_NETWORKS = [
  "NOLUS",
  "OSMOSIS",
  "COSMOS_HUB",
  "AXELAR",
  "STRIDE",
  "JUNO",
  "EVMOS",
  "PERSISTENCE",
  "SECRET",
  "STARGAZE",
  "CELESTIA",
  "NEUTRON",
  "DYDX"
];
export const SWAP_FEE = 0.007;
export const ZERO_DECIMALS = 6;
export const USD_DECIMALS = 6;
export const MAX_DECIMALS = 8;
export const LedgerName = "Ledger";
export const IGNORE_LEASE_ASSETS: string[] = [
  "Q_ATOM",
  "Q_ATOM@OSMOSIS",
  "Q_ATOM@NEUTRON",
  "STK_ATOM"
];
export const IGNORE_TRANSFER_ASSETS: string[] = ["Q_ATOM", "Q_ATOM@OSMOSIS", "Q_ATOM@NEUTRON"];
export const IGNORE_LEASES: string[] = [
  "nolus1suz0vsqe8c8anckaer98awhqs8r4hu7wsm8a49acdl39x6ylfypsqywxwh",
  "nolus1q2ekwjj87jglqsszwy6ah5t08h0k8kq67ed0l899sku2qt0dztpsnwt6sw"
];
export const NEWS_URL = news;
export const NEWS_WALLETS_PATH = newsWalletsPath

export const CurrencyMapping: {
  [key: string]: {
    ticker: string;
    name?: string;
  };
} = {
  WETH_AXELAR: {
    ticker: "WETH"
  },
  USDC_AXELAR: {
    ticker: "USDC",
    name: "USDC.axl"
  },
  WBTC_AXELAR: {
    ticker: "WBTC"
  }
};

export const CurrencyDemapping: {
  [key: string]: {
    ticker: string;
    name?: string;
  };
} = {
  WETH: {
    ticker: "WETH_AXELAR"
  },
  USDC: {
    ticker: "USDC_AXELAR",
    name: "USDC.axl"
  },
  WBTC: {
    ticker: "WBTC_AXELAR"
  }
};

export const ProtocolsConfig: {
  [key: string]: {
    hidden: string[];
  };
} = {
  OSMOSIS: {
    hidden: []
  },
  NEUTRON: {
    hidden: ["ATOM", "ST_ATOM"]
  }
};

export const FREE_INTEREST_ASSETS = ["NTRN"];
export const SUPPORT_URL = "https://hub.nolus.io";
export const ETL_API = "https://etl-cl.nolus.network:8080/api";
export const DOWNPAYMENT_RANGE_URL =
  "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/downpayment-range.json";
export const SWAP_FEE_URL =
  "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/swap-fee.json";
export const OPEAN_LEASE_FEE_URL =
  "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/open-lease-fee.json";
export const FREE_INTEREST_ADDRESS_URL =
  "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/zero/0interest-payments.json";
export const Filament = filament;
