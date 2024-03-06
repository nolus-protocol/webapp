import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@cosmjs/amino";
import type { Network } from "@/common/types";

export interface SendComponentProps {
  wallet?: string;
  receiverErrorMsg: string;
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  memo: string;
  receiverAddress: string;
  txHash: string;
  fee: Coin;
  network: Network;
  dialogSelectedCurrency: string;
  onNextClick: () => void;
}
