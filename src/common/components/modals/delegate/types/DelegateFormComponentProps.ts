import type { ExternalCurrency } from "@/common/types";
import type { Coin } from "@cosmjs/amino";

export interface DelegateFormComponentProps {
  amountErrorMsg: string;
  currentBalance: ExternalCurrency[];
  selectedCurrency: ExternalCurrency;
  amount: string;
  txHash: string;
  fee: Coin;
  onNextClick: () => void;
}
