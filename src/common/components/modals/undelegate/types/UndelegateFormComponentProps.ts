import type { ExternalCurrency, IObjectKeys } from "@/common/types";
import type { Coin } from "@cosmjs/amino";

export interface UndelegateFormComponentProps {
  amountErrorMsg: string;
  currentBalance: ExternalCurrency[];
  selectedCurrency: ExternalCurrency;
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
