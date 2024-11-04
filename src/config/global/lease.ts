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

let DOWNPAYMENT_RANGE_URL = (protocol: string) => {
  return `/downpayment-range/${protocol}/downpayment-range.json`;
};

let FREE_INTEREST_ADDRESS_URL: Promise<string> | string = import("../zero/0interest-payments.json?url").then(
  (t) => t.default
);

let IGNORE_LEASE_ASSETS_URL: Promise<string> | string = import("../lease/ignore-lease-assets.json?url").then(
  (t) => t.default
);

let IGNORE_DOWNPAYMENT_ASSETS_URL: Promise<string> | string = import(
  "../lease/ignore-downpayment-assets.json?url"
).then((t) => t.default);

if (!isDev()) {
  DOWNPAYMENT_RANGE_URL = (protocol: string) => {
    return `https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/downpayment-range/${protocol}/downpayment-range.json`;
  };
  FREE_INTEREST_ADDRESS_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/zero/0interest-payments.json";
  IGNORE_LEASE_ASSETS_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/ignore-lease-assets.json";
  IGNORE_DOWNPAYMENT_ASSETS_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/ignore-downpayment-assets.json";
}

export { DOWNPAYMENT_RANGE_URL, FREE_INTEREST_ADDRESS_URL, IGNORE_LEASE_ASSETS_URL, IGNORE_DOWNPAYMENT_ASSETS_URL };

// export const IGNORE_LEASE_ASSETS: string[] = [
//   "JUNO",
//   "EVMOS",
//   "STRD",
//   "LVN",
//   "DYM",
//   "Q_ATOM",
//   "STARS",
//   "PICA",
//   "STK_ATOM",
//   "ATOM@NEUTRON-ASTROPORT-USDC_NOBLE",
//   "ST_TIA@NEUTRON-ASTROPORT-USDC_NOBLE",
//   "USDC",
//   "USDC_AXELAR",
//   "STK_ATOM",
//   "LVN",
//   "EVMOS",
//   "JKL",
//   "CUDOS",
//   "SCRT",
//   "CRO",
//   "WBTC_AXELAR",
//   "WBTC"
// ];

// export const IGNORE_DOWNPAYMENT_ASSETS: string[] = [
//   "STK_ATOM",
//   "SCRT",
//   "LVN",
//   "JKL",
//   "EVMOS",
//   "NLS",
//   "DYM",
//   "CUDOS",
//   "Q_ATOM",
//   "JUNO",
//   "STARS",
//   "CRO",
//   "STRD",
//   "WBTC_AXELAR",
//   "WBTC",
//   "PICA"
// ];

export const IGNORE_LEASE_ASSETS_STABLES: string[] = ["USDC_NOBLE"];
export const IGNORE_LEASES: string[] = ["nolus1mqezz2qs8cy8qx50yms0r6xc3lae20tms8dqq3t2tl7dd6gnxhxq3kz4uf"];
