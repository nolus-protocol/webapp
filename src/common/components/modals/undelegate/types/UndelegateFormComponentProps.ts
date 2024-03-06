import type { AssetBalance } from "@/common/stores/wallet/types";
import type { IObjectKeys } from "@/common/types";
import type { Coin } from "@cosmjs/amino";

export interface UndelegateFormComponentProps {
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  txHash: string;
  fee: Coin;
  delegated: Coin | null;
  undelegations:
    | {
        entries: {
          balance: string;
          completion_time: string;
        }[];
      }[]
    | IObjectKeys[];
  onNextClick: () => void;
}
