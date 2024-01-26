<template>
  <div :class="{ 'animate-pulse': !state.initialLoad }" class="block">
    <template v-if="state.initialLoad && !state.showSkeleton">
      <TransitionGroup
        appear
        class="flex flex-wrap flex-row lg:gap-x-5 gap-y-8"
        name="fade-long"
        tag="div"
      >
        <ProposalItem
          v-for="(proposal, index) in state.proposals"
          :key="index"
          :state="proposal"
          @vote="onVote"
          @read-more="onReadMore"
        />
      </TransitionGroup>
      <div class="text-center mt-6 lg:mt-8">
        <button
          v-if="visible"
          :class="{ 'js-loading': state.loading }"
          class="btn btn-secondary btn-medium-secondary mx-auto"
          @click="loadMoreProposals"
        >
          {{ $t('message.load-more') }}
        </button>
      </div>
      <Modal v-if="state.showReadMoreModal" @close-modal="onCloseReadMoreModal">
        <ProposalReadMoreDialog
          :source="state.proposal.description"
          :title="state.proposal.title"
        />
      </Modal>
      <Modal v-if="state.showVoteModal" @close-modal="onCloseVoteModal">
        <ProposalVoteDialog :proposal="state.proposal" />
      </Modal>
    </template>
    <template v-else>
      <ProposalSkeleton />
    </template>
  </div>
  <Modal v-if="state.showErrorDialog" route="alert" @close-modal="state.showErrorDialog = false">
    <ErrorDialog
      :message="state.errorMessage"
      :title="$t('message.error-connecting')"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, reactive } from 'vue'
import { AppUtils } from '@/utils/AppUtils'
import { type Proposal } from '@/modules/vote/Proposal'
import ProposalItem from '@/modules/vote/components/ProposalItem.vue'
import ProposalReadMoreDialog from '@/modules/vote/components/ProposalReadMoreDialog.vue'
import ProposalVoteDialog from '@/modules/vote/components/ProposalVoteDialog.vue'
import Modal from '@/components/modals/templates/Modal.vue'
import ProposalSkeleton from '@/modules/vote/components/ProposalSkeleton.vue'
import ErrorDialog from '@/components/modals/ErrorDialog.vue'

interface CustomError extends Error {
  message: string
}

const LOAD_TIMEOUT = 500

const state = reactive({
  showErrorDialog: false,
  errorMessage: '',
  showReadMoreModal: false,
  showVoteModal: false,
  loading: false,
  initialLoad: false,
  showSkeleton: true,
  proposals: [] as Proposal[],
  proposal: {
    id: '',
    title: '',
    description: ''
  },
  limit: 6,
  pagination: {
    total: 0,
    next_key: ''
  },
  timeout: null as NodeJS.Timeout | null
})

onMounted(async () => {
  await fetchGovernanceProposals()
})

onUnmounted(() => {
  if (state.timeout) {
    clearTimeout(state.timeout)
  }
})

const fetchData = async (url: string) => {
  try {
    const req = await fetch(url)
    return await req.json()
  } catch (error: CustomError | any) {
    state.showErrorDialog = true
    state.errorMessage = error.message
    console.error(error)
    return null
  }
}

const fetchGovernanceProposals = async () => {
  const node = await AppUtils.getArchiveNodes()
  const data = await fetchData(
    `${node.archive_node_api}/cosmos/gov/v1beta1/proposals?pagination.limit=${state.limit}&pagination.reverse=true&pagination.countTotal=true`
  )

  if (!data) return

  state.proposals = data.proposals
  state.pagination = data.pagination

  state.initialLoad = true
  state.timeout = setTimeout(() => {
    state.showSkeleton = false
  }, LOAD_TIMEOUT)
}

const onReadMore = ({ description, title }: { description: string; title: string }) => {
  state.showReadMoreModal = true
  state.proposal = {
    ...state.proposal,
    description,
    title
  }
}

const onCloseReadMoreModal = () => {
  state.showReadMoreModal = false
}

const onVote = (selectedProposal: Proposal) => {
  state.showVoteModal = true
  state.proposal = {
    ...state.proposal,
    title: selectedProposal.content.title,
    id: selectedProposal.proposal_id
  }
}

const onCloseVoteModal = () => {
  state.showVoteModal = false
}

const visible = computed(() => {
  return state.initialLoad && state.pagination.next_key
})

const loadMoreProposals = async () => {
  state.loading = true
  const node = await AppUtils.getArchiveNodes()
  const data = await fetchData(
    `${node.archive_node_api}/cosmos/gov/v1beta1/proposals?pagination.limit=${state.limit}&pagination.key=${state.pagination.next_key}&pagination.reverse=true&pagination.countTotal=true`
  )

  if (!data) return

  state.proposals = [...state.proposals, ...data.proposals]
  state.pagination = data.pagination

  setTimeout(() => {
    state.loading = false
  }, LOAD_TIMEOUT)
}

async function onClickTryAgain() {
  await fetchGovernanceProposals()
}
</script>

<style lang="scss" scoped></style>
