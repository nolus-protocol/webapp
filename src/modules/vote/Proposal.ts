export interface Proposal {
  proposal_id: string
  content: ProposalContent
  status: ProposalStatus
  final_tally_result: FinalTallyResult
  tally: FinalTallyResult
  submit_time: string
  deposit_end_time: string
  total_deposit: TotalDeposit[]
  voting_start_time: string
  voting_end_time: string
}

export enum ProposalStatus {
  PROPOSAL_STATUS_UNSPECIFIED = 'PROPOSAL_STATUS_UNSPECIFIED',
  PROPOSAL_STATUS_DEPOSIT_PERIOD = 'PROPOSAL_STATUS_DEPOSIT_PERIOD',
  PROPOSAL_STATUS_VOTING_PERIOD = 'PROPOSAL_STATUS_VOTING_PERIOD',
  PROPOSAL_STATUS_PASSED = 'PROPOSAL_STATUS_PASSED',
  PROPOSAL_STATUS_REJECTED = 'PROPOSAL_STATUS_REJECTED',
  PROPOSAL_STATUS_FAILED = 'PROPOSAL_STATUS_FAILED'
}

export interface ProposalContent {
  '@type': string
  title: string
  description: string
  subject_client_id: string
  substitute_client_id: string
}

export interface FinalTallyResult {
  yes: string
  abstain: string
  no: string
  no_with_veto: string
}

export interface TotalDeposit {
  denom: string
  amount: string
}
