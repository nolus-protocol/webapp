import { ref, type Ref } from "vue";
import { Logger, WalletManager } from "@/common/utils";
import { type Proposal } from "@/modules/vote/types";
import { ProposalStatus } from "web-components";
import { BackendApi } from "@/common/api";
import { getProposalsConfig } from "@/common/utils/ConfigService";

export const useFetchGovernanceProposals = () => {
  const LOAD_TIMEOUT = 500;
  const limit = ref(6);

  const fetchGovernanceProposals = async ({
    timeout,
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
    const address = WalletManager.getWalletAddress();
    
    const [proposalsResponse, proposalsConfig] = await Promise.all([
      BackendApi.getProposals(limit.value, address || undefined),
      getProposalsConfig()
    ]);

    // Filter out hidden proposals
    const filteredProposals = proposalsResponse.proposals.filter(
      (item) => !proposalsConfig.hide.includes(item.id)
    );

    // Map to the expected Proposal type
    const mappedProposals: Proposal[] = filteredProposals.map((p) => ({
      id: p.id,
      status: p.status as ProposalStatus,
      final_tally_result: p.final_tally_result,
      submit_time: p.submit_time,
      deposit_end_time: p.deposit_end_time,
      voting_start_time: p.voting_start_time,
      voting_end_time: p.voting_end_time,
      title: p.title,
      summary: p.summary,
      messages: p.messages,
      metadata: p.metadata,
      tally: p.tally,
      voted: p.voted
    }));

    proposals.value = mappedProposals;
    pagination.value = {
      total: parseInt(proposalsResponse.pagination.total, 10),
      next_key: proposalsResponse.pagination.next_key || ""
    };

    initialLoad.value = true;
    timeout = setTimeout(() => {
      showSkeleton.value = false;
    }, LOAD_TIMEOUT);
  };

  const fetchData = async (url: string) => {
    try {
      const [proposalsResponse, reqConfig] = await Promise.all([
        BackendApi.getProposals(limit.value),
        getProposalsConfig()
      ]);

      const filteredProposals = proposalsResponse.proposals.filter(
        (item) => !reqConfig.hide.includes(item.id)
      );

      return {
        proposals: filteredProposals,
        pagination: proposalsResponse.pagination
      };
    } catch (error: Error | any) {
      Logger.error(error);
      return null;
    }
  };

  const fetchProposalData = async (proposal: Proposal) => {
    const address = WalletManager.getWalletAddress();
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
              proposal.voted = response?.vote?.options?.length > 0;
            })
            .catch((e) => {
              Logger.error(e);
              proposal.voted = false;
            })
        );
      }

      await Promise.allSettled(promises);
    } catch (error: Error | any) {
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
