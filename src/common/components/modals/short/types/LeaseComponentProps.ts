import type { ExternalCurrency } from "@/common/types";
import type { Coin } from "@cosmjs/amino";
import type { LeaseApply } from "@nolus/nolusjs/build/contracts";

export interface LeaseComponentProps {
  contractAddress: string;
  downPaymentErrorMsg: string;
  currentBalance: ExternalCurrency[];
  selectedDownPaymentCurrency: ExternalCurrency;
  selectedCurrency: ExternalCurrency;
  dialogSelectedCurrency: null | string;
  downPayment: string;
  memo: string;
  txHash: string;
  leaseApply: LeaseApply | null;
  fee: Coin;
  ltd: number;
  onNextClick: (price: string) => void;
}
