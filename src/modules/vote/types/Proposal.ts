import type { ProposalStatus } from "web-components";

export interface Proposal {
  id: string;
  title: string;
  summary: string;
  messages: ProposalContent[];
  status: Exclude<ProposalStatus, ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD>;
  tally: FinalTallyResult;
  submit_time: string;
  deposit_end_time: string;
  total_deposit: TotalDeposit[];
  voting_start_time: string;
  voting_end_time: string;
  voted: boolean;
}

export interface ProposalContent {
  "@type": string;
  authority: string;
  params: {
    quorum: string;
    threshold: string;
  };
}

export interface FinalTallyResult {
  yes_count: string;
  abstain_count: string;
  no_count: string;
  no_with_veto_count: string;
}

export interface TotalDeposit {
  denom: string;
  amount: string;
}
