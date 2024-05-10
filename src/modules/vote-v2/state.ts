import type { Proposal } from "@/modules/vote-v2/types";
import { ProposalStatus } from "@/modules/vote-v2/types";

export const ProposalState: Proposal = {
  id: "",
  title: "",
  summary: "",
  voted: false,
  messages: [
    {
      "@type": "",
      authority: "",
      params: {
        quorum: "",
        threshold: ""
      }
    }
  ],
  status: ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD,
  tally: {
    abstain_count: "",
    no_count: "",
    no_with_veto_count: "",
    yes_count: ""
  },
  submit_time: "",
  voting_end_time: "",
  deposit_end_time: "",
  total_deposit: [],
  voting_start_time: ""
};
