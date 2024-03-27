import { isServe } from "./modes";

export const DEFAULT_LEASE_UP_PERCENT = "150.00";
export const LEASE_UP_COEFICIENT = 1.5;
export const DEFAULT_APR = "24.34";

export const minimumLeaseAmount = 1;
export const POSITIONS = 5;
export const MIN_POSITION = 25;
export const MAX_POSITION = 150;
export const DEFAULT_LTD = 1.5;
export const FREE_INTEREST_ASSETS = ["NTRN"];
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

if (!isServe()) {
  DOWNPAYMENT_RANGE_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/downpayment-range.json";
  SWAP_FEE_URL = "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/lease/swap-fee.json";
  FREE_INTEREST_ADDRESS_URL =
    "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/zero/0interest-payments.json";
}

export { DOWNPAYMENT_RANGE_URL, SWAP_FEE_URL, FREE_INTEREST_ADDRESS_URL };
export const IGNORE_LEASE_ASSETS: string[] = ["STK_ATOM", "DYDX"];
export const IGNORE_LEASES: string[] = [
  "nolus1suz0vsqe8c8anckaer98awhqs8r4hu7wsm8a49acdl39x6ylfypsqywxwh",
  "nolus1q2ekwjj87jglqsszwy6ah5t08h0k8kq67ed0l899sku2qt0dztpsnwt6sw"
];
