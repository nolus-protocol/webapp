import type { OpenedLeaseInfo } from "@nolus/nolusjs/build/contracts";
import type { AssetBalance } from "@/stores/wallet/state";
import type { Coin } from "@cosmjs/amino";

export interface MarketCloseComponentProps {
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
  swapFee: number,
  onNextClick: () => void;
}
