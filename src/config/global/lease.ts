import { isDev } from "./modes";

export const DEFAULT_LEASE_UP_PERCENT = "150.00";
export const LEASE_UP_COEFICIENT = 1.5;
export const DEFAULT_APR = "24.34";

export const minimumLeaseAmount = 1;
export const POSITIONS = 5;
export const MIN_POSITION = 25;
export const MAX_POSITION = 150;
export const DEFAULT_LTD = 1.5;

export const LEASE_DUE = 2 * 24 * 60 * 60 * 1000 * 1000 * 1000;
export const DOWNPAYMENT_RANGE_DEV = 15;

export const WASM_EVENTS = {
  "wasm-ls-request-loan": {
    key: "wasm-ls-request-loan",
    index: 0
  }
};

let DOWNPAYMENT_RANGE_URL: Promise<string> | string = import("../lease/downpayment-range.json?url").then(
  (t) => t.default
);
let SWAP_FEE_URL: Promise<string> | string = import("../lease/swap-fee?url").then((t) => t.default);
let FREE_INTEREST_ADDRESS_URL: Promise<string> | string = import("../zero/0interest-payments.json?url").then(
  (t) => t.default
);

if (!isDev()) {
  DOWNPAYMENT_RANGE_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/downpayment-range.json";
  SWAP_FEE_URL = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/swap-fee.json";
  FREE_INTEREST_ADDRESS_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/zero/0interest-payments.json";
}

export { DOWNPAYMENT_RANGE_URL, SWAP_FEE_URL, FREE_INTEREST_ADDRESS_URL };

export const FREE_INTEREST_ASSETS: string[] = [
  "AKT",
  "ATOM",
  "AXL",
  "CRO",
  "DYDX",
  "DYM",
  "EVMOS",
  "INJ",
  "JKL",
  "JUNO",
  "LVN",
  "milkTIA",
  "NTRN",
  "OSMO",
  "PICA",
  "qATOM",
  "SCRT",
  "STARS",
  "stkATOM",
  "STRD",
  "stATOM",
  "stOSMO",
  "stTIA",
  "TIA",
  "WBTC",
  "WETH",
  "CUDOS",
  "dATOM"
];

export const IGNORE_LEASE_ASSETS: string[] = [
  "JUNO",
  "EVMOS",
  "STRD",
  "LVN",
  "DYM",
  "Q_ATOM",
  "STARS",
  "PICA",
  "STK_ATOM",
  "ATOM@NEUTRON-ASTROPORT-USDC_NOBLE",
  "ST_TIA@NEUTRON-ASTROPORT-USDC_NOBLE",
  "USDC",
  "USDC_AXELAR",
  "STK_ATOM",
  "LVN",
  "EVMOS"
];

export const IGNORE_DOWNPAYMENT_ASSETS: string[] = ["STK_ATOM", "LVN", "EVMOS", "NLS"];

export const IGNORE_LEASE_ASSETS_STABLES: string[] = ["USDC_NOBLE"];

export const IGNORE_LEASES: string[] = ["nolus1mqezz2qs8cy8qx50yms0r6xc3lae20tms8dqq3t2tl7dd6gnxhxq3kz4uf"];
