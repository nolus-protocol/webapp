import { AssetBalance } from '@/store/modules/wallet/state'
import { TxType } from '@/types/TxType'

export interface SupplyFormComponentProps {
  amountErrorMsg: string
  currentBalance: AssetBalance[]
  selectedCurrency: AssetBalance
  amount: string
  receiverAddress: string
  currentAPR: string
  password: string
  txHash: string
  txType: TxType
  onNextClick: () => void
}
