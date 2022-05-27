import { Asset } from '@/contracts/models/Asset'

export interface DownpaymentResp {
  total: Asset,
  borrow: Asset,
  annualInterestRate: string
}
