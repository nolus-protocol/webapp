import type { AssetBalance } from "@/stores/wallet/state";
import type { Coin } from "@keplr-wallet/unit";

export interface UndelegateFormComponentProps {
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  password: string;
  txHash: string;
  fee: Coin;
  delegated: Coin | null;
  undelegations: {
    entries: {
      balance: string,
      completion_time: string
    }[]
  }[],
  onNextClick: () => void;
}
