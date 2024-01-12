import type { AssetBalance } from "@/stores/wallet/state";
import type { Coin } from "@cosmjs/amino";
import type { Int } from "@keplr-wallet/unit";

export interface SupplyFormComponentProps {
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  receiverAddress: string;
  currentAPR: string;
  password: string;
  txHash: string;
  supply: boolean;
  loading: boolean;
  fee: Coin;
  maxSupply: Int | any;
  selectedAsset: string,
  onNextClick: () => void;
}
