import type { OpenedLeaseInfo } from "@nolus/nolusjs/build/contracts";
import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@cosmjs/amino";

export interface RepayComponentProps {
  leaseInfo: OpenedLeaseInfo;
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  receiverAddress: string;
  txHash: string;
  fee: Coin;
  swapFee: number;
  onNextClick: () => void;
}
