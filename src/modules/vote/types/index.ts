import type { AssetBalance } from "@/common/stores/wallet/types";
import type { Coin } from "@cosmjs/amino";
import type { VoteOption } from "cosmjs-types/cosmos/gov/v1beta1/gov";

export interface VoteComponentProps {
  currentBalance: AssetBalance[];
  txHash: string;
  fee: Coin;
  amountErrorMsg: string;
  vote: VoteOption | null;
}

export { type FinalTallyResult, type Proposal, type ProposalContent, type TotalDeposit } from "./Proposal";
