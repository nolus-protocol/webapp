import type { AssetBalance } from '@/stores/wallet/state';
import type { Coin } from '@cosmjs/amino';

export interface SendComponentProps {
  receiverErrorMsg: string;
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  memo: string;
  receiverAddress: string;
  password: string;
  txHash: string;
  fee: Coin;
  onNextClick: () => void;
}
