import { AssetBalance } from '@/store/modules/wallet/state'

export interface ClaimComponentProps {
  selectedCurrency: AssetBalance
  amount: string
  password: string
  txHash: string
  onNextClick: () => void
}
