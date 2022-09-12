import { AssetBalance } from '@/store/modules/wallet/state'

export interface ClaimComponentProps {
  amountErrorMsg: string
  receiverAddress: string
  selectedCurrency: AssetBalance
  amount: string
  password: string
  txHash: string
  onNextClick: () => void
}
