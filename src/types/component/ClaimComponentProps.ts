import type { AssetBalance } from "@/stores/wallet/state";

export interface ClaimComponentProps {
  selectedCurrency: AssetBalance;
  amount: string;
  password: string;
  txHash: string;
  onNextClick: () => void;
}
