import { NolusClient } from '@/client/NolusClient'
import { getPrices } from '@/contracts/oracle/OracleMsg'
import { CONTRACTS } from '@/config/contracts.config'

export interface Price {
  amount: string,
  denom: string
}

export interface Denom {
  denom: string,
  price: Price
}

export interface Prices {
  prices: Denom[]
}

export class Oracle {
  public async getPrices (denoms: string[]): Promise<Prices> {
    const cosm = await NolusClient.getInstance().getCosmWasmClient()
    return await cosm.queryContractSmart(CONTRACTS.oracle.instance, getPrices(denoms))
  }
}
