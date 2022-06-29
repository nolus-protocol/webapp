export interface ContractsInfo {
  instance: string;
  codeId: string;
}

export const CONTRACTS: { [key: string]: ContractsInfo } = {
  oracle: {
    instance: 'nolus1s8uk3v45ydxrj2xq4lgn246kvcrqqra6u3r83yzx0t00gs30kasq5fmmhw',
    codeId: '66'
  },
  leaser: {
    instance: 'nolus1ur7hv5e2ws5yueqd2845ktnrns4ujyxt2dvfwtm8uhw5awxjuzhsz90h63',
    codeId: '69'
  }
}
