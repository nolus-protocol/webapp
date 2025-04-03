import { ref, type Ref } from "vue";
import { AppUtils, Logger, WalletManager } from "@/common/utils";
import { ChainConstants } from "@nolus/nolusjs";
import { type Proposal } from "@/modules/vote/types";
import { ProposalStatus } from "web-components";

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
    const node = await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);

    const data = await fetchData(
      `${node.api}/cosmos/gov/v1/proposals?pagination.limit=${limit.value}&pagination.reverse=true&pagination.countTotal=true`
    );
    if (!data) return;

    const promises = [];

    for (const item of data.proposals) {
      if (item.status == ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD) {
        promises.push(fetchProposalData(item));
      }
    }

    await Promise.all(promises);
    proposals.value = data.proposals;
    pagination.value = data.pagination;

    initialLoad.value = true;
    timeout = setTimeout(() => {
      showSkeleton.value = false;
    }, LOAD_TIMEOUT);
  };

  const fetchData = async (url: string) => {
    try {
      const [reqProposals, reqConfig] = await Promise.all([fetch(url), AppUtils.getProposalsConfig()]);

      const data = await reqProposals.json();
      data.proposals = data.proposals.filter((item: Proposal) => !reqConfig.hide.includes(item.id));
      return data;
    } catch (error: Error | any) {
      Logger.error(error);
      return null;
    }
  };

  const fetchProposalData = async (proposal: Proposal) => {
    const address = WalletManager.getWalletAddress();
    try {
      const node = await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);
      const promises = [
        fetch(`${node.api}/cosmos/gov/v1/proposals/${proposal.id}/tally`)
          .then((d) => d.json())
          .then((item) => {
            proposal.tally = item.tally;
          })
      ];
      if (address) {
        promises.push(
          fetch(`${node.api}/cosmos/gov/v1/proposals/${proposal.id}/votes/${address}`)
            .then((d) => d.json())
            .then((item) => {
              proposal.voted = item?.vote?.options?.length > 0;
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
