import type { ExternalCurrency } from "@/common/types";
import type { Coin } from "@cosmjs/amino";
import type { Int } from "@keplr-wallet/unit";

export interface SupplyFormComponentProps {
  amountErrorMsg: string;
  currentBalance: ExternalCurrency[];
  selectedCurrency: ExternalCurrency;
  amount: string;
  receiverAddress: string;
  currentAPR: string;
  txHash: string;
  supply: boolean;
  loading: boolean;
  fee: Coin;
  maxSupply: Int | any;
  selectedAsset: string;
  disabled: boolean;
  onNextClick: () => void;
}
