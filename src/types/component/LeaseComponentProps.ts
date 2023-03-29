import type { AssetBalance } from "@/stores/wallet/state";
import type { Coin } from "@cosmjs/amino";
import type { LeaseApply } from "@nolus/nolusjs/build/contracts";

export interface LeaseComponentProps {
  contractAddress: string;
  downPaymentErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedDownPaymentCurrency: AssetBalance;
  selectedCurrency: AssetBalance;
  dialogSelectedCurrency: null | string;
  downPayment: string;
  memo: string;
  password: string;
  passwordErrorMsg: string;
  txHash: string;
  leaseApply: LeaseApply | null;
  fee: Coin;
  position: number,
  ltv: number
  onNextClick: (price: string) => void;
}
