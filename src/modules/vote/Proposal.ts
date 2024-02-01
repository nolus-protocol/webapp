export interface Proposal {
  id: string;
  title: string;
  summary: string;
  messages: ProposalContent[];
  status: ProposalStatus;
  tally: FinalTallyResult
  submit_time: string;
  deposit_end_time: string;
  total_deposit: TotalDeposit[];
  voting_start_time: string;
  voting_end_time: string;
}

export enum ProposalStatus {
  PROPOSAL_STATUS_UNSPECIFIED = "PROPOSAL_STATUS_UNSPECIFIED",
  PROPOSAL_STATUS_DEPOSIT_PERIOD = "PROPOSAL_STATUS_DEPOSIT_PERIOD",
  PROPOSAL_STATUS_VOTING_PERIOD = "PROPOSAL_STATUS_VOTING_PERIOD",
  PROPOSAL_STATUS_PASSED = "PROPOSAL_STATUS_PASSED",
  PROPOSAL_STATUS_REJECTED = "PROPOSAL_STATUS_REJECTED",
  PROPOSAL_STATUS_FAILED = "PROPOSAL_STATUS_FAILED"
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
