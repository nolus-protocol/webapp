import type { OpenedLeaseInfo } from "@nolus/nolusjs/build/contracts";
import type { AssetBalance } from "@/stores/wallet/state";
import type { Coin } from "@cosmjs/amino";

export interface RepayComponentProps {
  leaseInfo: OpenedLeaseInfo;
  amountErrorMsg: string;
  passwordErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  receiverAddress: string;
  password: string;
  txHash: string;
  fee: Coin;
  onNextClick: () => void;
}
