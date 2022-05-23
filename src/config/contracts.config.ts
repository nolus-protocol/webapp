export interface ContractsInfo {
  'instance': string,
  'code_id': string
}

export const CONTRACTS: { [key: string]: ContractsInfo; } = {
  oracle: {
    instance: 'nolus1vej3dgf5slwlu9rs32tl09kf0zrh24j2rqhzpaaywtpwfhe9v8fsksp2h6',
    code_id: '42'
  },
  leaser: {
    instance: 'nolus17u2a36dg0zv9t8zdfmxczzam0kp0r6tvlqm46amxz7qcfjm04tsqk06mrs',
    code_id: '45'
  }
}
