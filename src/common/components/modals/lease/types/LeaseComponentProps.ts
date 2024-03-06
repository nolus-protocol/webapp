import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@cosmjs/amino";
import type { LeaseApply } from "@nolus/nolusjs/build/contracts";

export interface LeaseComponentProps {
  contractAddress: string;
  downPaymentErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedDownPaymentCurrency: AssetBalance;
  selectedCurrency: AssetBalance;
  dialogSelectedCurrency: null | string;
  downPayment: string;
  memo: string;
  txHash: string;
  leaseApply: LeaseApply | null;
  fee: Coin;
  ltd: number;
  onNextClick: (price: string) => void;
}
