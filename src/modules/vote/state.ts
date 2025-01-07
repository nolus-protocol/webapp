import type { Proposal } from "@/modules/vote/types";
import { ProposalStatus } from "web-components";

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
  status: ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD as Exclude<
    ProposalStatus,
    ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD
  >,
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
