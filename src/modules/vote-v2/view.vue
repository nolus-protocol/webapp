<template>
  <div
    :class="{ 'animate-pulse': !initialLoad }"
    class="mt-8 block md:mt-0"
  >
    <template v-if="initialLoad && !showSkeleton">
      <TransitionGroup
        appear
        class="flex flex-row flex-wrap gap-y-8 lg:gap-x-5"
        name="fade-long"
        tag="div"
      >
        <ProposalItemWrapper
          v-for="proposal in proposals"
          :key="proposal.id"
          :bondedTokens="bondedTokens as Dec"
          :quorum="quorum as Dec"
          :state="proposal"
          @vote="onVote"
          @read-more="onReadMore"
        />
      </TransitionGroup>
      <div class="mt-6 text-center lg:mt-8">
        <Button
          v-if="visible"
          :label="$t('message.load-more')"
          :loading="loading"
          class="mx-auto"
          severity="secondary"
          size="medium"
          @click="loadMoreProposals"
        />
      </div>
      <Modal
        v-if="showReadMoreModal"
        @close-modal="onCloseReadMoreModal"
      >
        <ProposalReadMoreDialog
          :source="proposal.summary"
          :title="proposal.title"
        />
      </Modal>
      <Modal
        v-if="showVoteModal"
        @close-modal="onCloseVoteModal"
      >
        <ProposalVoteDialog :proposal="proposal" />
      </Modal>
    </template>
    <template v-else>
      <ProposalSkeleton />
    </template>
  </div>
  <!-- <Modal
    v-if="showErrorDialog"
    route="alert"
    @close-modal="showErrorDialog = false"
  >
    <ErrorDialog
      :message="errorMessage"
      :title="$t('message.error-connecting')"
      :try-button="onClickTryAgain"
    />
  </Modal> -->
</template>

<script lang="ts" setup>
import { type Proposal, ProposalStatus } from "@/modules/vote-v2/types/Proposal";
import { computed, onMounted, onUnmounted, provide, ref } from "vue";
import { AppUtils, Logger, WalletManager } from "@/common/utils";
import { Dec } from "@keplr-wallet/unit";
import { ChainConstants } from "@nolus/nolusjs";
import ProposalItemWrapper from "@/modules/vote-v2/components/ProposalItemWrapper.vue";
import ProposalReadMoreDialog from "@/modules/vote-v2/components/ProposalReadMoreDialog.vue";
import ProposalVoteDialog from "@/modules/vote-v2/components/ProposalVoteDialog.vue";
import Modal from "@/common/components/modals/templates/Modal.vue";
import ProposalSkeleton from "@/modules/vote-v2/components/ProposalSkeleton.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";

import { Button } from "web-components";

const LOAD_TIMEOUT = 500;
const bondedTokens = ref(new Dec(0));
const quorum = ref(new Dec(0));

const showErrorDialog = ref(false);
const errorMessage = ref("");
const showReadMoreModal = ref(false);
const showVoteModal = ref(false);
const loading = ref(false);
const initialLoad = ref(false);
const showSkeleton = ref(true);
const proposal = ref({
  id: "",
  title: "",
  summary: ""
});
const limit = ref(6);
const pagination = ref({
  total: 0,
  next_key: ""
});
let timeout = null as NodeJS.Timeout | null;

const proposals = ref([] as Proposal[]);

onMounted(async () => {
  await Promise.allSettled([fetchGovernanceProposals(), loadBondedTokens(), loadTallying()]);
});

onUnmounted(() => {
  if (timeout) {
    clearTimeout(timeout);
  }
});

async function loadBondedTokens() {
  const node = await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);
  const res = await fetch(`${node.api}/cosmos/staking/v1beta1/pool`);
  const data = await res.json();
  bondedTokens.value = new Dec(data.pool.bonded_tokens);
}

async function loadTallying() {
  const node = await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);

  const res = await fetch(`${node.api}/cosmos/gov/v1/params/tallying`);
  const data = await res.json();
  quorum.value = new Dec(data.params.quorum);
}

async function fetchProposalData(proposal: Proposal) {
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
            if (item?.vote?.options?.length > 0) {
              proposal.voted = true;
            } else {
              proposal.voted = false;
            }
          })
          .catch((e) => {
            Logger.error(e);
            proposal.voted = false;
          })
      );
    }
    await Promise.allSettled(promises);
  } catch (error: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = error?.message;
  }
}

async function refetchProposalData(id: string) {
  const index = proposals.value.findIndex((item) => item.id == id);
  if (index > -1 && proposals.value[index].status == ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD) {
    await fetchProposalData(proposals.value[index]);
  }
}

async function fetchData(url: string) {
  try {
    const [reqProposals, reqConfig] = await Promise.all([fetch(url), AppUtils.getProposalsConfig()]);

    const data = await reqProposals.json();
    data.proposals = data.proposals.filter((item: Proposal) => !reqConfig.hide.includes(item.id));
    return data;
  } catch (error: Error | any) {
    showErrorDialog.value = true;
    errorMessage.value = error.message;
    Logger.error(error);
    return null;
  }
}

async function fetchGovernanceProposals() {
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
}

function onReadMore({ summary, title }: { summary: string; title: string }) {
  showReadMoreModal.value = true;
  proposal.value = {
    ...proposal.value,
    summary,
    title
  };
}

function onCloseReadMoreModal() {
  showReadMoreModal.value = false;
}

function onVote(selectedProposal: Proposal) {
  showVoteModal.value = true;
  proposal.value = {
    ...proposal.value,
    title: selectedProposal.title,
    id: selectedProposal.id
  };
}

function onCloseVoteModal() {
  showVoteModal.value = false;
}

const visible = computed(() => {
  return initialLoad.value && pagination.value.next_key;
});

async function loadMoreProposals() {
  loading.value = true;
  const node = await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY);

  const data = await fetchData(
    `${node.api}/cosmos/gov/v1/proposals?pagination.limit=${limit.value}&pagination.key=${pagination.value.next_key}&pagination.reverse=true&pagination.countTotal=true`
  );

  if (!data) return;

  const promises = [];

  for (const item of data.proposals) {
    promises.push(fetchProposalData(item));
  }

  await Promise.all(promises);

  proposals.value = [...proposals.value, ...data.proposals];
  pagination.value = data.pagination;

  setTimeout(() => {
    loading.value = false;
  }, LOAD_TIMEOUT);
}

async function onClickTryAgain() {
  await fetchGovernanceProposals();
}

provide("refetchProposalData", refetchProposalData);
</script>

<style lang="scss" scoped></style>
