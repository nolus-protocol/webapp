import type { ContractConfig } from '@/types';

export const CONTRACTS: ContractConfig = {
  devnet: {
    oracle: {
      instance: 'nolus1436kxs0w2es6xlqpp9rd35e3d0cjnw4sv8j3a7483sgks29jqwgsv3wzl4',
      codeId: '',
    },
    leaser: {
      instance: 'nolus1zwv6feuzhy6a9wekh96cd57lsarmqlwxdypdsplw6zhfncqw6ftqmx7chl',
      codeId: '',
    },
  },
  testnet: {
    oracle: {
      instance: 'nolus1436kxs0w2es6xlqpp9rd35e3d0cjnw4sv8j3a7483sgks29jqwgsv3wzl4',
      codeId: '',
    },
    leaser: {
      instance: 'nolus1zwv6feuzhy6a9wekh96cd57lsarmqlwxdypdsplw6zhfncqw6ftqmx7chl',
      codeId: '',
    },
  },
};

export const LPP_CONSTANTS: ContractConfig = {
  devnet: {
    uusdc: {
      instance: 'nolus1qg5ega6dykkxc307y25pecuufrjkxkaggkkxh7nad0vhyhtuhw3sqaa3c5',
      codeId: '',
    },
  },
};
