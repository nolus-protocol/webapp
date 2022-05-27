import { NolusClient } from '@/client/NolusClient'
import { getPrices } from '@/contracts/oracle/OracleMsg'
import { CONTRACTS } from '@/config/contracts.config'
import { OraclePricesResp } from '@/contracts/models/OraclePricesResp'

export class Oracle {
  public async getPrices (denoms: string[]): Promise<OraclePricesResp> {
    const cosm = await NolusClient.getInstance().getCosmWasmClient()
    return await cosm.queryContractSmart(CONTRACTS.oracle.instance, getPrices(denoms))
  }
}
