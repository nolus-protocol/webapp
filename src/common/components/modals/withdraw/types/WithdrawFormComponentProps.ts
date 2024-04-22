import type { ExternalCurrency } from "@/common/types";
import type { Coin } from "@cosmjs/amino";

export interface WithdrawFormComponentProps {
  currentDepositBalance: ExternalCurrency;
  amountErrorMsg: string;
  receiverAddress: string;
  currentBalance: ExternalCurrency[];
  selectedCurrency: ExternalCurrency;
  amount: string;
  txHash: string;
  fee: Coin;
  selectedAsset: string;
  disabled: boolean;
  onNextClick: () => void;
}
