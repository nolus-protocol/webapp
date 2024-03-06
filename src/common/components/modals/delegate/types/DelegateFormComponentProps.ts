import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@cosmjs/amino";

export interface DelegateFormComponentProps {
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  txHash: string;
  fee: Coin;
  onNextClick: () => void;
}
