import { NolusClient } from '@/client/NolusClient'
import { CONTRACTS } from '@/config/contracts.config'
import { Prices } from '@/contracts/oracle/Oracle'
import { getDownpayment } from '@/contracts/lease/LeaseMsg'

export class Lease {
  public async getDownpayment (amount: string, denom: string): Promise<Prices> {
    const cosm = await NolusClient.getInstance().getCosmWasmClient()
    return await cosm.queryContractSmart(CONTRACTS.leaser.instance, getDownpayment(amount, denom))
  }
}
