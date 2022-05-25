export interface ContractsInfo {
  'instance': string,
  'code_id': string
}

export const CONTRACTS: { [key: string]: ContractsInfo; } = {
  oracle: {
    instance: 'nolus12vfkgtcz83jm47zu9wy8mywe40egvzrvrl9elml0uk7ukdz2txxse7hr85',
    code_id: '66'
  },
  leaser: {
    instance: 'nolus1scfauhsp7trtjymxf67t6tlf332732uhnedrumra5sp790t6e7zse730uv',
    code_id: '69'
  }
}
