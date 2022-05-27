import { Asset } from '@/contracts/models/Asset'

export interface Denom {
  denom: string,
  price: Asset
}

export interface OraclePricesResp {
  prices: Denom[]
}
