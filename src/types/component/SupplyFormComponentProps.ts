import { AssetBalance } from '@/store/modules/wallet/state'

export interface SupplyFormComponentProps {
  amountErrorMsg: string
  currentBalance: AssetBalance[]
  selectedCurrency: AssetBalance
  amount: string
  receiverAddress: string
  currentAPR: string
  password: string
  txHash: string
  onNextClick: () => void
}
