import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@cosmjs/amino";

export interface WithdrawFormComponentProps {
  currentDepositBalance: AssetBalance;
  amountErrorMsg: string;
  receiverAddress: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  txHash: string;
  fee: Coin;
  selectedAsset: string;
  onNextClick: () => void;
}
