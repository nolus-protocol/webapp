import type { NetworkAddress } from "@/types";
import nlsIcon from "@/assets/icons/coins/nls.svg";
import { Dec } from "@keplr-wallet/unit";

export const DEFAULT_PRIMARY_NETWORK = "testnet";

export const NETWORKS: { [key: string]: NetworkAddress } = {
  localnet: {
    tendermintRpc: "http://127.0.0.1:26612",
    api: "http://127.0.0.1:26614",
    exploler: "https://explorer-rila.nolus.io/",
    govern: "https://explorer-rila.nolus.io/nolus-rila/gov",
    staking: "https://explorer-rila.nolus.io/nolus-rila/staking",
    web3auth: {
      clientId: "BHPGnOodSp4t0ZDuuJ3suCZCtwVILYmfOTbDrzlUKK6ADFrNMWg563MAMj_CBW8sDVvg3BqJi8i284t6o",
      network: "testnet",
      google: {
        name: "Nolus",
        verifier: "nolusprotocol",
        typeOfLogin: "google",
        clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com",
      },
    }
  },
  devnet: {
    tendermintRpc: "https://net-dev-26612.nolus.io",
    api: "https://net-dev.nolus.io:26614",
    exploler: "https://explorer-rila.nolus.io/",
    govern: "https://explorer-rila.nolus.io/nolus-rila/gov",
    staking: "https://explorer-rila.nolus.io/nolus-rila/staking",
    web3auth: {
      clientId: "BHYXk3KjVtoSMkmePippWgXv3vbgJnXnsORt9G4maaPsqNqcbK_TPF5WC6oPIm8xVaM21iHRRjUl0JhHft4ZgqY",
      network: "cyan",
      google: {
        name: "Nolus",
        verifier: "nolusprotocol",
        typeOfLogin: "google",
        clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com",
      },
    }
  },
  testnet: {
    tendermintRpc: "https://net-rila.nolus.io:26657",
    api: "https://net-rila.nolus.io:1317",
    exploler: "https://explorer-rila.nolus.io/",
    govern: "https://explorer-rila.nolus.io/nolus-rila/gov",
    staking: "https://explorer-rila.nolus.io/nolus-rila/staking",
    web3auth: {
      clientId: "BHYXk3KjVtoSMkmePippWgXv3vbgJnXnsORt9G4maaPsqNqcbK_TPF5WC6oPIm8xVaM21iHRRjUl0JhHft4ZgqY",
      network: "cyan",
      google: {
        name: "Nolus",
        verifier: "nolusprotocol",
        typeOfLogin: "google",
        clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com",
      },
    }
  },
  mainnet: {
    tendermintRpc: "https://net-rila.nolus.io:26657",
    api: "https://net-rila.nolus.io:1317",
    exploler: "https://explorer.nolus.io/nolus/",
    govern: "https://explorer.nolus.io/nolus/gov",
    staking: "https://explorer.nolus.io/nolus/staking",
    web3auth: {
      clientId: "BHYXk3KjVtoSMkmePippWgXv3vbgJnXnsORt9G4maaPsqNqcbK_TPF5WC6oPIm8xVaM21iHRRjUl0JhHft4ZgqY",
      network: "cyan",
      google: {
        name: "Nolus",
        verifier: "nolusprotocol",
        typeOfLogin: "google",
        clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com",
      },
    },
  },
};

export const NATIVE_CURRENCY = {
  currency: "usd",
  symbol: "$",
  locale: "en-US",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

export const NATIVE_ASSET = {
  ticker: "NLS",
  label: "NLS",
  value: "NLS",
  denom: "unls",
  icon: nlsIcon,
};

export const NATIVE_NETWORK = {
  prefix: "nolus",
  value: "nls",
  label: "Nolus",
  icon: nlsIcon,
  native: true,
  estimation: 6,
  longOperationsEstimation: 20,
  leaseOpenEstimation: 2,
  sourceChannel: "",
  key: "NLS"
};

export enum SOURCE_PORTS {
  TRANSFER = "transfer"
}

export enum GROUPS {
  Lpn = "Lpn",
  Lease = "Lease",
  Payment = "Payment",
}

export enum SNACKBAR {
  Queued = "queued",
  Success = "success",
  Error = "error",
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
  swap_amount: 5000,
};

export enum APPEARANCE {
  light = "light",
  dark = "dark",
  sync = "sync",
}

export const UPDATE_BLOCK_INTERVAL = 5 * 1000;
export const UPDATE_BALANCE_INTERVAL = 5 * 1000;
export const UPDATE_PRICES_INTERVAL = 10 * 1000;
export const UPDATE_REWARDS_INTERVAL = 5 * 1000;

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
}

export const LEASE_MIN_AMOUNT = { amount: 40, ticker: 'USDC' };
export const LEASE_MAX_AMOUNT = { amount: 200, ticker: 'USDC' };;

export const INTEREST_DECIMALS = 1;
export const PERMILLE = 1000;

export const WASM_EVENTS = {
  "wasm-ls-request-loan": {
    key: "wasm-ls-request-loan",
    index: 0
  }
}

export const LIQUIDATION = new Dec(0.9);
export const calculateLiquidation = (unit: Dec, price: Dec) => {
  return unit.quo(price).quo(LIQUIDATION);
}

export const MAX_POSITION = 150;
export const MIN_POSITION = 20;
export const DEFAULT_LTV = 600;
export const WASM_LP_DEPOSIT = "wasm-lp-deposit"
export const WASM_LP_OPEN = "wasm-ls-open";

export const calculateBaseQuote = (amount: Dec) => {
  return amount.quo(new Dec((1 + MAX_POSITION / 100)));
}

export const REPAYMENT_VALUES = [25, 50, 75, 100];
export const ADDITIONAL_OUTSTANDING_DEBT = 0.001;