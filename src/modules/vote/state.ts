import type { Proposal } from '@/modules/vote/Proposal'
import { ProposalStatus } from '@/modules/vote/Proposal'

export const ProposalState: Proposal = {
  proposal_id: '',
  content: {
    title: '',
    description: '',
    '@type': '',
    subject_client_id: '',
    substitute_client_id: ''
  },
  voting_end_time: '',
  deposit_end_time: '',
  status: ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD,
  final_tally_result: {
    abstain: '',
    no: '',
    no_with_veto: '',
    yes: ''
  },
  tally: {
    abstain: '',
    no: '',
    no_with_veto: '',
    yes: ''
  },
  submit_time: '',
  total_deposit: [],
  voting_start_time: ''
}
