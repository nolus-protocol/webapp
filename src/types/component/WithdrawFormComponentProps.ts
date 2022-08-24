import { AssetBalance } from '@/store/modules/wallet/state'

export interface WithdrawFormComponentProps {
  amountErrorMsg: string
  receiverAddress: string
  currentBalance: AssetBalance[]
  selectedCurrency: AssetBalance
  amount: string
  password: string
  txHash: string
  onNextClick: () => void
}
