import { isDev } from "./modes";

export const DEFAULT_LEASE_UP_PERCENT = "150.00";
export const LEASE_UP_COEFICIENT = 1.5;
export const DEFAULT_APR = "24.34";

export const minimumLeaseAmount = 1;
export const POSITIONS = 5;
export const MIN_POSITION = 25;
export const MAX_POSITION = 150;
export const DEFAULT_LTD = 1.5;

export const LEASE_DUE = 3 * 24 * 60 * 60 * 1000 * 1000 * 1000;
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

let IGNORE_LEASE_LONG_ASSETS_URL: Promise<string> | string = import("../lease/ignore-lease-long-assets.json?url").then(
  (t) => t.default
);

let IGNORE_LEASE_SHORT_ASSETS_URL: Promise<string> | string = import(
  "../lease/ignore-lease-short-assets.json?url"
).then((t) => t.default);

let IGNORE_ASSETS_URL: Promise<string> | string = import("../lease/ignore-assets.json?url").then((t) => t.default);

if (!isDev()) {
  DOWNPAYMENT_RANGE_URL = (protocol: string) => {
    return `https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/downpayment-range/${protocol}/downpayment-range.json`;
  };
  FREE_INTEREST_ADDRESS_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/zero/0interest-payments.json";
  IGNORE_LEASE_LONG_ASSETS_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/ignore-lease-long-assets.json";
  IGNORE_LEASE_SHORT_ASSETS_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/ignore-lease-short-assets.json";
  IGNORE_ASSETS_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/ignore-assets.json";
}

export {
  DOWNPAYMENT_RANGE_URL,
  FREE_INTEREST_ADDRESS_URL,
  IGNORE_LEASE_LONG_ASSETS_URL,
  IGNORE_LEASE_SHORT_ASSETS_URL,
  IGNORE_ASSETS_URL
};

export const IGNORE_LEASE_ASSETS_STABLES: string[] = ["USDC_NOBLE"];
export const IGNORE_LEASES: string[] = ["nolus1mqezz2qs8cy8qx50yms0r6xc3lae20tms8dqq3t2tl7dd6gnxhxq3kz4uf"];
