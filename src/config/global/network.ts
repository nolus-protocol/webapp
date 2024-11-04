import nlsIcon from "@/assets/icons/coins/nls.svg";
import { ChainType } from "@/common/types/Network";

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
  icon: nlsIcon,
  decimal_digits: 6
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
  symbol: "NLS",
  chain_type: ChainType.cosmos
};

export const STAKING = {
  VALIDATORS_NUMBER: 2,
  SLASHED_DAYS: 30 * 24 * 60 * 60 * 1000,
  PERCENT: 0.05,
  SLICE: 3
};
