import nlsIcon from "@/assets/icons/coins/nls.svg";
import type { NetworkAddress } from "@/types";

export const DEFAULT_PRIMARY_NETWORK = "devnet";

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
    tendermintRpc: "https://net-dev.nolus.io:26612",
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
  create_vesting_account: 100000,
  delegation: 150000,
  undelegation: 200000,
  withdraw_delegator_reward: 150000,
  lender_deposit: 1000,
  lender_burn_deposit: 1200,
  lender_claim_rewards: 170000,
  transfer_amount: 500,
  open_lease: 1500,
  repay_lease: 1500,
  swap_amount: 1500,
};

export enum APPEARANCE {
  light = "light",
  dark = "dark",
  sync = "sync",
}

export const UPDATE_BLOCK_INTERVAL = 5 * 1000; // 5000 ms
export const UPDATE_BALANCE_INTERVAL = 5 * 1000; // 5000 ms
export const UPDATE_PRICES_INTERVAL = 10 * 1000; // 10000 ms

export const DEFAULT_LEASE_UP_PERCENT = "150.00";
export const LEASE_UP_COEFICIENT = 1.5;
export const DEFAULT_APR = "24.34";
