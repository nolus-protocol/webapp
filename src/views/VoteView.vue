<template>
  <div :class="{ 'animate-pulse': !state.initialLoad }"
       class="block md:mt-0 mt-8">
    <template v-if="state.initialLoad && !state.showSkeleton">
      <TransitionGroup appear
                       class="flex flex-wrap flex-row lg:gap-x-5 gap-y-8"
                       name="fade-long"
                       tag="div">
        <ProposalItem v-for="proposal in proposals"
                      :key="proposal.id"
                      :state="proposal"
                      :bondedTokens="bondedTokens"
                      @vote="onVote"
                      @read-more="onReadMore" />
      </TransitionGroup>
      <div class="text-center mt-6 lg:mt-8">
        <button v-if="visible"
                :class="{ 'js-loading': state.loading }"
                class="btn btn-secondary btn-medium-secondary mx-auto"
                @click="loadMoreProposals">
          {{ $t('message.load-more') }}
        </button>
      </div>
      <Modal v-if="state.showReadMoreModal"
             @close-modal="onCloseReadMoreModal">
        <ProposalReadMoreDialog :source="state.proposal.summary"
                                :title="state.proposal.title" />
      </Modal>
      <Modal v-if="state.showVoteModal"
             @close-modal="onCloseVoteModal">
        <ProposalVoteDialog :proposal="state.proposal" />
      </Modal>
    </template>
    <template v-else>
      <ProposalSkeleton />
    </template>
  </div>
  <Modal v-if="state.showErrorDialog"
         route="alert"
         @close-modal="state.showErrorDialog = false">
    <ErrorDialog :message="state.errorMessage"
                 :title="$t('message.error-connecting')"
                 :try-button="onClickTryAgain" />
  </Modal>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import { AppUtils } from '@/utils/AppUtils'
import { type Proposal } from '@/modules/vote/Proposal'
import ProposalItem from '@/modules/vote/components/ProposalItem.vue'
import ProposalReadMoreDialog from '@/modules/vote/components/ProposalReadMoreDialog.vue'
import ProposalVoteDialog from '@/modules/vote/components/ProposalVoteDialog.vue'
import Modal from '@/components/modals/templates/Modal.vue'
import ProposalSkeleton from '@/modules/vote/components/ProposalSkeleton.vue'
import ErrorDialog from '@/components/modals/ErrorDialog.vue'
import { provide } from 'vue'
import { Dec } from '@keplr-wallet/unit'

interface CustomError extends Error {
  message: string
}

const LOAD_TIMEOUT = 500
const bondedTokens = ref(new Dec(0));

const state = ref({
  showErrorDialog: false,
  errorMessage: '',
  showReadMoreModal: false,
  showVoteModal: false,
  loading: false,
  initialLoad: false,
  showSkeleton: true,
  proposal: {
    id: '',
    title: '',
    summary: ''
  },
  limit: 6,
  pagination: {
    total: 0,
    next_key: ''
  },
  timeout: null as NodeJS.Timeout | null
});

const proposals = ref([] as Proposal[]);

onMounted(async () => {
  await Promise.allSettled([
    fetchGovernanceProposals(),
    loadBondedTokens()
  ])
})

onUnmounted(() => {
  if (state.value.timeout) {
    clearTimeout(state.value.timeout)
  }
})

const loadBondedTokens = async () => {
  const node = await AppUtils.getArchiveNodes()
  const res = await fetch(
    `${node.archive_node_api}/cosmos/staking/v1beta1/pool`
  )
  const data = await res.json();
  bondedTokens.value = new Dec(data.pool.bonded_tokens);
}

const fetchTally = async (proposal: Proposal) => {
  try {
    const node = await AppUtils.getArchiveNodes()
    const r = await fetch(
      `${node.archive_node_api}/cosmos/gov/v1/proposals/${proposal.id}/tally`
    )
    const d = await r.json();
    proposal.tally = d.tally;
    return proposal;

  } catch (error: Error | any) {
    console.log(error)
    state.value.showErrorDialog = true
    state.value.errorMessage = error?.message
  }

}

const reFetchTally = async (id: string) => {
  const index = proposals.value.findIndex((item) => item.id == id);
  if (index > -1) {
    proposals.value[index] = await fetchTally(proposals.value[index]) as Proposal;
  }
}

const fetchData = async (url: string) => {
  try {
    const req = await fetch(url)
    return await req.json()
  } catch (error: CustomError | any) {
    state.value.showErrorDialog = true
    state.value.errorMessage = error.message
    console.error(error)
    return null
  }
}

const fetchGovernanceProposals = async () => {
  const node = await AppUtils.getArchiveNodes()
  const data = await fetchData(
    `${node.archive_node_api}/cosmos/gov/v1/proposals?pagination.limit=${state.value.limit}&pagination.reverse=true&pagination.countTotal=true`
  )
  if (!data) return

  const promises = [];

  for (const item of data.proposals) {
    promises.push(fetchTally(item));
  }

  await Promise.all(promises);
  proposals.value = data.proposals
  state.value.pagination = data.pagination

  state.value.initialLoad = true
  state.value.timeout = setTimeout(() => {
    state.value.showSkeleton = false
  }, LOAD_TIMEOUT)
}

const onReadMore = ({ summary, title }: { summary: string; title: string }) => {
  state.value.showReadMoreModal = true
  state.value.proposal = {
    ...state.value.proposal,
    summary,
    title
  }
}

const onCloseReadMoreModal = () => {
  state.value.showReadMoreModal = false
}

const onVote = (selectedProposal: Proposal) => {
  state.value.showVoteModal = true
  state.value.proposal = {
    ...state.value.proposal,
    title: selectedProposal.title,
    id: selectedProposal.id
  }
}

const onCloseVoteModal = () => {
  state.value.showVoteModal = false
}

const visible = computed(() => {
  return state.value.initialLoad && state.value.pagination.next_key
})

const loadMoreProposals = async () => {
  state.value.loading = true
  const node = await AppUtils.getArchiveNodes()
  const data = await fetchData(
    `${node.archive_node_api}/cosmos/gov/v1/proposals?pagination.limit=${state.value.limit}&pagination.key=${state.value.pagination.next_key}&pagination.reverse=true&pagination.countTotal=true`
  )

  if (!data) return

  const promises = [];

  for (const item of data.proposals) {
    promises.push(fetchTally(item));
  }

  await Promise.all(promises);

  proposals.value = [...proposals.value, ...data.proposals]
  state.value.pagination = data.pagination

  setTimeout(() => {
    state.value.loading = false
  }, LOAD_TIMEOUT)
}

async function onClickTryAgain() {
  await fetchGovernanceProposals()
}

provide('reFetchTally', reFetchTally)

</script>

<style lang="scss" scoped></style>
