import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@cosmjs/amino";

export interface WithdrawRewardsComponentProps {
  selectedCurrency: AssetBalance;
  amount: string;
  txHash: string;
  fee: Coin;
  onNextClick: () => void;
}
