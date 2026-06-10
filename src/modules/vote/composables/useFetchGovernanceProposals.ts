import { ref, type Ref } from "vue";
import { Logger, WalletStorage } from "@/common/utils";
import { type Proposal, type ProposalContent } from "@/modules/vote/types";
import { BackendApi } from "@/common/api";
import type { ProposalInfo } from "@/common/api/types/governance";
import { getProposalsConfig } from "@/common/utils/ConfigService";

function isProposalContent(value: unknown): value is ProposalContent {
  return typeof value === "object" && value !== null && "@type" in value && typeof value["@type"] === "string";
}

function toProposal(p: ProposalInfo): Proposal {
  return {
    id: p.id,
    // The runtime status set includes PROPOSAL_STATUS_VOTING_PERIOD, which
    // Proposal["status"] excludes by (pre-existing) design; the assertion keeps
    // the long-standing lie at the single mapping boundary.
    status: p.status as Proposal["status"],
    submit_time: p.submit_time ?? "",
    deposit_end_time: p.deposit_end_time ?? "",
    total_deposit: [],
    voting_start_time: p.voting_start_time ?? "",
    voting_end_time: p.voting_end_time ?? "",
    title: p.title ?? "",
    summary: p.summary ?? "",
    messages: p.messages.filter(isProposalContent),
    tally: p.tally ?? { yes_count: "0", abstain_count: "0", no_count: "0", no_with_veto_count: "0" },
    voted: p.voted ?? false
  };
}

export const useFetchGovernanceProposals = () => {
  const LOAD_TIMEOUT = 500;
  const limit = ref(6);

  const fetchGovernanceProposals = async ({
    proposals,
    pagination,
    initialLoad,
    showSkeleton
  }: {
    timeout: NodeJS.Timeout | null;
    proposals: Ref<Proposal[]>;
    pagination: Ref<{ total: number; next_key: string }>;
    initialLoad: Ref<boolean>;
    showSkeleton: Ref<boolean>;
  }) => {
    const address = WalletStorage.getWalletAddress();

    const [proposalsResponse, proposalsConfig] = await Promise.all([
      BackendApi.getProposals(limit.value, address || undefined),
      getProposalsConfig()
    ]);

    // Filter out hidden proposals
    const filteredProposals = proposalsResponse.proposals.filter((item) => !proposalsConfig.hide.includes(item.id));

    proposals.value = filteredProposals.map(toProposal);
    pagination.value = {
      total: parseInt(proposalsResponse.pagination.total, 10),
      next_key: proposalsResponse.pagination.next_key || ""
    };

    initialLoad.value = true;
    setTimeout(() => {
      showSkeleton.value = false;
    }, LOAD_TIMEOUT);
  };

  const fetchData = async (_url: string) => {
    try {
      const [proposalsResponse, reqConfig] = await Promise.all([
        BackendApi.getProposals(limit.value),
        getProposalsConfig()
      ]);

      const filteredProposals = proposalsResponse.proposals.filter((item) => !reqConfig.hide.includes(item.id));

      return {
        proposals: filteredProposals.map(toProposal),
        pagination: {
          total: parseInt(proposalsResponse.pagination.total, 10),
          next_key: proposalsResponse.pagination.next_key || ""
        }
      };
    } catch (error: unknown) {
      Logger.error(error);
      return null;
    }
  };

  const fetchProposalData = async (proposal: Proposal) => {
    const address = WalletStorage.getWalletAddress();
    try {
      const promises: Promise<void>[] = [
        BackendApi.getProposalTally(proposal.id).then((response) => {
          proposal.tally = response.tally;
        })
      ];

      if (address) {
        promises.push(
          BackendApi.getProposalVote(proposal.id, address)
            .then((response) => {
              proposal.voted = (response?.vote?.options?.length ?? 0) > 0;
            })
            .catch((e) => {
              Logger.error(e);
              proposal.voted = false;
            })
        );
      }

      await Promise.allSettled(promises);
    } catch (error: unknown) {
      Logger.error(error);
    }
  };

  return {
    fetchGovernanceProposals,
    fetchData,
    fetchProposalData,
    limit,
    LOAD_TIMEOUT
  };
};
