import type { AssetBalance } from "@/stores/wallet/state";
import type { Coin } from "@cosmjs/amino";
import type { VoteOption } from "cosmjs-types/cosmos/gov/v1beta1/gov";

export interface VoteComponentProps {
  currentBalance: AssetBalance[];
  password: string;
  txHash: string;
  fee: Coin;
  amountErrorMsg: string;
  vote: VoteOption | null;
}
