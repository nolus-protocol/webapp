import { NolusClient } from '@/client/NolusClient'
import { CONTRACTS } from '@/config/contracts.config'
import { getDownpayment } from '@/contracts/lease/LeaseMsg'
import { DownpaymentResp } from '@/contracts/models/DownpaymentResp'

export class Lease {
  public async getDownpayment (amount: string, denom: string): Promise<DownpaymentResp> {
    const cosm = await NolusClient.getInstance().getCosmWasmClient()
    return await cosm.queryContractSmart(CONTRACTS.leaser.instance, getDownpayment(amount, denom))
  }
}
