import type { AssetBalance } from '@/stores/wallet/state';
import type { LeaseApply } from '@nolus/nolusjs/build/contracts';

export interface LeaseComponentProps {
  contractAddress: string;
  amountErrorMsg: string;
  downPaymentErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedDownPaymentCurrency: AssetBalance;
  selectedCurrency: AssetBalance;
  downPayment: string;
  amount: string;
  memo: string;
  password: string;
  passwordErrorMsg: string;
  txHash: string;
  leaseApply: LeaseApply | null;
  onNextClick: () => void;
}
