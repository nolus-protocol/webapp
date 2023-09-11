import type { AssetBalance } from "@/stores/wallet/state";
import type { Coin } from "@cosmjs/amino";
import type { Network } from "@/types";

export interface SendComponentProps {
  wallet?: string;
  receiverErrorMsg: string;
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  memo: string;
  receiverAddress: string;
  password: string;
  txHash: string;
  fee: Coin;
  network: Network;
  onNextClick: () => void;
}
