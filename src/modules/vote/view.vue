<template>
  <div class="flex flex-col gap-8">
    <ListHeader :title="$t('message.vote')" />
    <template v-if="initialLoad && !showSkeleton">
      <TransitionGroup
        appear
        class="flex flex-col flex-wrap justify-between gap-y-8 md:flex-row"
        name="fade-long"
        tag="div"
      >
        <ProposalItemWrapper
          v-for="proposal in proposals"
          :key="proposal.id"
          :bondedTokens="bondedTokensDec"
          :quorum="quorumDec"
          :state="proposal"
          @actionButton="onActionButton"
          class="h-fit flex-[0_calc(100%/2-16px)]"
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
      <VoteDialog
        ref="dialog"
        :proposal="selectedProposal"
        :bondedTokens="bondedTokensDec"
        :quorumTokens="quorumDec"
      />
    </template>
    <template v-else>
      <ProposalSkeleton />
    </template>
  </div>
</template>

<script lang="ts" setup>
import ListHeader from "@/common/components/ListHeader.vue";
import { computed, onUnmounted, ref, watch } from "vue";
import { ChainConstants } from "@nolus/nolusjs";
import { Dec } from "@keplr-wallet/unit";
import { Button } from "web-components";
import { type Proposal } from "@/modules/vote/types";
import { ProposalItemWrapper, ProposalSkeleton, VoteDialog } from "@/modules/vote/components";
import { useFetchGovernanceProposals, useLoadBondedTokens, useLoadTallying } from "./composables";
import { useConfigStore } from "@/common/stores/config";
import { fetchEndpoints } from "@/common/utils/EndpointService";

const dialog = ref<InstanceType<typeof VoteDialog> | null>(null);
const initialLoad = ref(false);
const showSkeleton = ref(true);
const loading = ref(false);
const configStore = useConfigStore();

const pagination = ref({
  total: 0,
  next_key: ""
});
let loadMoreTimer: NodeJS.Timeout | null = null;

const proposals = ref([] as Proposal[]);
const selectedProposal = ref({
  title: "",
  id: ""
} as Proposal);

const { fetchGovernanceProposals, fetchProposalData, fetchData, LOAD_TIMEOUT, limit } = useFetchGovernanceProposals();
const { loadBondedTokens, bondedTokens } = useLoadBondedTokens();
const { loadTallying, quorum } = useLoadTallying();

// ref(new Dec(...)) erases Dec's private members from the unwrapped type, so the
// composable values are rebuilt as real Dec instances for the typed Dec props.
const bondedTokensDec = computed(() => new Dec(bondedTokens.value.toString()));
const quorumDec = computed(() => new Dec(quorum.value.toString()));

// Reacts to: configStore.initialized.
// Idempotency: onInit() runs a Promise.allSettled over the proposal / bonded-token
// / tally fetches, each safe to repeat; the immediate run performs the initial load.
watch(
  () => configStore.initialized,
  () => {
    if (configStore.initialized) {
      void onInit();
    }
  },
  {
    immediate: true
  }
);

async function onInit() {
  await Promise.allSettled([
    fetchGovernanceProposals({ timeout: null, pagination, proposals, initialLoad, showSkeleton }),
    loadBondedTokens(),
    loadTallying()
  ]);
}

onUnmounted(() => {
  if (loadMoreTimer) {
    clearTimeout(loadMoreTimer);
  }
});

const visible = computed(() => {
  return initialLoad.value && pagination.value.next_key;
});

async function loadMoreProposals() {
  loading.value = true;
  const node = await fetchEndpoints(ChainConstants.CHAIN_KEY);

  const data = await fetchData(
    `${node.api}/cosmos/gov/v1/proposals?pagination.limit=${limit.value}&pagination.key=${pagination.value.next_key}&pagination.reverse=true&pagination.countTotal=true`
  );

  if (!data) {
    loading.value = false;
    return;
  }

  const promises = [];

  for (const item of data.proposals) {
    promises.push(fetchProposalData(item));
  }

  await Promise.all(promises);

  proposals.value = [...proposals.value, ...data.proposals];
  pagination.value = data.pagination;

  loadMoreTimer = setTimeout(() => {
    loading.value = false;
  }, LOAD_TIMEOUT);
}

function onActionButton(proposal: Proposal) {
  selectedProposal.value = proposal;
  dialog.value?.show();
}
</script>
