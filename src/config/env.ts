import nlsIcon from '@/assets/icons/coins/nls.svg';
import type { NetworkAddress } from '@/types';
export const DEFAULT_PRIMARY_NETWORK = 'devnet';

export const NETWORKS: { [key: string]: NetworkAddress } = {
  localnet: {
    tendermintRpc: 'http://127.0.0.1:26612',
    api: 'http://127.0.0.1:26614',
    exploler : 'https://explorer-rila.nolus.io/',
    govern: 'https://explorer-rila.nolus.io/nolus-rila/staking',
    web3auth: {
      clientId: "BHPGnOodSp4t0ZDuuJ3suCZCtwVILYmfOTbDrzlUKK6ADFrNMWg563MAMj_CBW8sDVvg3BqJi8i284t6o",
      network: 'testnet',
      google: {
        name: "Nolus",
        verifier: "nolusprotocol",
        typeOfLogin: "google",
        clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com",
      },
    }
  },
  devnet: {
    tendermintRpc: 'https://net-dev.nolus.io:26612',
    api: 'https://net-dev.nolus.io:26614',
    exploler : 'https://explorer-rila.nolus.io/',
    govern: 'https://explorer-rila.nolus.io/nolus-rila/staking',
    web3auth: {
      clientId: "BHYXk3KjVtoSMkmePippWgXv3vbgJnXnsORt9G4maaPsqNqcbK_TPF5WC6oPIm8xVaM21iHRRjUl0JhHft4ZgqY",
      network: 'cyan',
      google: {
        name: "Nolus",
        verifier: "nolusprotocol",
        typeOfLogin: "google",
        clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com",
      },
    }
  },
  testnet: {
    tendermintRpc: 'https://net-rila.nolus.io:26657',
    api: 'https://net-rila.nolus.io:1317',
    exploler : 'https://explorer-rila.nolus.io/',
    govern: 'https://explorer-rila.nolus.io/nolus-rila/staking',
    web3auth: {
      clientId: "BHYXk3KjVtoSMkmePippWgXv3vbgJnXnsORt9G4maaPsqNqcbK_TPF5WC6oPIm8xVaM21iHRRjUl0JhHft4ZgqY",
      network: 'cyan',
      google: {
        name: "Nolus",
        verifier: "nolusprotocol",
        typeOfLogin: "google",
        clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com",
      },
    }
  },
  mainnet: {
    tendermintRpc: 'https://net-rila.nolus.io:26657',
    api: 'https://net-rila.nolus.io:1317',
    exploler : 'https://explorer.nolus.io/nolus/',
    govern: "https://explorer.nolus.io/nolus/staking",
    web3auth: {
      clientId: "BHYXk3KjVtoSMkmePippWgXv3vbgJnXnsORt9G4maaPsqNqcbK_TPF5WC6oPIm8xVaM21iHRRjUl0JhHft4ZgqY",
      network: 'cyan',
      google: {
        name: "Nolus",
        verifier: "nolusprotocol",
        typeOfLogin: "google",
        clientId: "408160298134-e8ul2n0p1ka3fe01oalnodb2l6fs9nb6.apps.googleusercontent.com",
      },
    }
  },
};

export const DEFAULT_CURRENCY = {
  currency: 'usd',
  symbol: '$',
  locale: 'en-US',
  minimumFractionDigits: 2
}

export const DEFAULT_NETWORK = {
  value: 'NLS',
  label: 'NLS',
};

export const DEFAULT_ASSET = {
  ticker: 'NLS',
  label: 'NLS',
  value: 'NLS',
  denom: 'unls',
  icon: nlsIcon,
};

export enum GROUPS {
  Lpn = 'Lpn',
  Lease = 'Lease',
  Payment = 'Payment'
}

export const UPDATE_BLOCK_INTERVAL = 5 * 1000; // 5000 ms
export const UPDATE_BALANCE_INTERVAL = 5 * 1000; // 5000 ms
export const UPDATE_PRICES_INTERVAL = 10 * 1000; // 10000 ms

export const DEFAULT_LEASE_UP_PERCENT = '150.00';
export const LEASE_UP_COEFICIENT = 1.5;
export const DEFAULT_APR = '24.34';
