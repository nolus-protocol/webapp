import type { OpenedLeaseInfo } from "@nolus/nolusjs/build/contracts";
import type { Coin } from "@cosmjs/amino";
import type { ExternalCurrency } from "@/common/types";

export interface RepayComponentProps {
  leaseInfo: OpenedLeaseInfo;
  amountErrorMsg: string;
  currentBalance: ExternalCurrency[];
  selectedCurrency: ExternalCurrency;
  amount: string;
  receiverAddress: string;
  txHash: string;
  fee: Coin;
  swapFee: number;
  protocol: string;
  onNextClick: () => void;
}
