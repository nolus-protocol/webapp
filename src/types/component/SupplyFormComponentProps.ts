import type { AssetBalance } from "@/stores/wallet/state";

export interface SupplyFormComponentProps {
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  receiverAddress: string;
  currentAPR: string;
  password: string;
  txHash: string;
  onNextClick: () => void;
}
