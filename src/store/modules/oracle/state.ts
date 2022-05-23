export interface Price {
  amount: string,
  denom: string
}

export type State = {
  prices: { [key: string]: Price } | null
}

export const state: State = {
  prices: null
}
