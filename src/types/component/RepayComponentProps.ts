import type { Asset } from "@nolus/nolusjs/build/contracts";
import type { AssetBalance } from "@/stores/wallet/state";

export interface RepayComponentProps {
  outstandingLoanAmount: Asset;
  amountErrorMsg: string;
  passwordErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  receiverAddress: string;
  password: string;
  txHash: string;
  onNextClick: () => void;
}
