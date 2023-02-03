import type { AssetBalance } from "@/stores/wallet/state";
import type { Coin } from "@cosmjs/amino";

export interface DelegateFormComponentProps {
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  receiverAddress: string;
  currentAPR: string;
  password: string;
  txHash: string;
  fee: Coin;
  onNextClick: () => void;
}
