import { ContractConfig } from '@/types/ContractConfig'

export const CONTRACTS: ContractConfig = {
  devnet: {
    oracle: {
      instance: 'nolus1mf6ptkssddfmxvhdx0ech0k03ktp6kf9yk59renau2gvht3nq2gqkxgywu',
      codeId: ''
    },
    leaser: {
      instance: 'nolus1zwv6feuzhy6a9wekh96cd57lsarmqlwxdypdsplw6zhfncqw6ftqmx7chl',
      codeId: ''
    }
  },
  testnet: {
    oracle: {
      instance: '',
      codeId: ''
    },
    leaser: {
      instance: '',
      codeId: ''
    }
  }
}

export const LPP_CONSTANTS: ContractConfig = {
  devnet: {
    uusdc: {
      instance: 'nolus1qg5ega6dykkxc307y25pecuufrjkxkaggkkxh7nad0vhyhtuhw3sqaa3c5',
      codeId: ''
    }
  }
}
