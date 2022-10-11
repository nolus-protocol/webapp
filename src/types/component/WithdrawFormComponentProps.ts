import type { AssetBalance } from "@/stores/wallet/state";

export interface WithdrawFormComponentProps {
  currentDepositBalance: AssetBalance;
  amountErrorMsg: string;
  receiverAddress: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  password: string;
  txHash: string;
  onNextClick: () => void;
}
