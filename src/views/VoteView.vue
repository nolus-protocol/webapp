<template>
  <div :class="{ 'animate-pulse': !initialLoad }" class="block">
    <template v-if="initialLoad && !showSkeleton">
      <TransitionGroup
        appear
        class="flex flex-wrap flex-row lg:gap-x-5 gap-y-8"
        name="fade-long"
        tag="div"
      >
        <ProposalItem
          v-for="(proposal, index) in proposals"
          :key="index"
          :state="proposal"
          @vote="onVote"
          @read-more="onReadMore"
        />
      </TransitionGroup>
      <div class="text-center mt-6 lg:mt-8">
        <button
          v-if="visible"
          :class="{ 'js-loading': loading }"
          class="btn btn-secondary btn-medium-secondary mx-auto"
          @click="loadMoreProposals"
        >
          {{ $t('message.load-more') }}
        </button>
      </div>
      <Modal v-if="showReadMoreModal" @close-modal="onCloseReadMoreModal">
        <ProposalReadMoreDialog :source="proposal.description" :title="proposal.title" />
      </Modal>
      <Modal v-if="showVoteModal" @close-modal="onCloseVoteModal">
        <ProposalVoteDialog :proposal="proposal" />
      </Modal>
    </template>
    <template v-else>
      <ProposalSkeleton />
    </template>
  </div>
  <Modal v-if="showErrorDialog" route="alert" @close-modal="showErrorDialog = false">
    <ErrorDialog
      :message="errorMessage"
      :title="$t('message.error-connecting')"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { AppUtils } from '@/utils/AppUtils'
import { type Proposal } from '@/modules/vote/Proposal'
import ProposalItem from '@/modules/vote/components/ProposalItem.vue'
import ProposalReadMoreDialog from '@/modules/vote/components/ProposalReadMoreDialog.vue'
import ProposalVoteDialog from '@/modules/vote/components/ProposalVoteDialog.vue'
import Modal from '@/components/modals/templates/Modal.vue'
import ProposalSkeleton from '@/modules/vote/components/ProposalSkeleton.vue'
import ErrorDialog from '@/components/modals/ErrorDialog.vue'

const showErrorDialog = ref(false)
const errorMessage = ref('')
const showReadMoreModal = ref(false)
const showVoteModal = ref(false)
const loading = ref(false)
const initialLoad = ref(false)
const showSkeleton = ref(true)

const proposals = ref([] as Proposal[])
const proposal = ref({
  id: '',
  title: '',
  description: ''
})
const limit = ref(6)
const pagination = ref({
  total: 0,
  next_key: ''
})
let timeout: NodeJS.Timeout

onMounted(async () => {
  await fetchGovernanceProposals()
})

onUnmounted(() => {
  if (timeout) {
    clearTimeout(timeout)
  }
})

const fetchGovernanceProposals = async () => {
  try {
    const node = await AppUtils.getArchiveNodes()
    const req = await fetch(
      `${node.archive_node_api}/cosmos/gov/v1beta1/proposals?pagination.limit=${limit.value}&pagination.reverse=true&pagination.countTotal=true`
    )

    const data = await req.json()

    proposals.value = data.proposals
    pagination.value = data.pagination

    initialLoad.value = true
  } catch (error: Error | any) {
    showErrorDialog.value = true
    errorMessage.value = error?.message
  } finally {
    timeout = setTimeout(() => {
      showSkeleton.value = false
    }, 400)
  }
}

const onReadMore = ({ description, title }: { description: string; title: string }) => {
  showReadMoreModal.value = true
  proposal.value = {
    ...proposal.value,
    description,
    title
  }
}

const onCloseReadMoreModal = () => {
  showReadMoreModal.value = false
}

const onVote = (selectedProposal: Proposal) => {
  showVoteModal.value = true
  proposal.value = {
    ...proposal.value,
    title: selectedProposal.content.title,
    id: selectedProposal.proposal_id
  }
}

const onCloseVoteModal = () => {
  showVoteModal.value = false
}

const visible = computed(() => {
  return initialLoad.value && pagination.value.next_key
})

const loadMoreProposals = async () => {
  try {
    loading.value = true
    const node = await AppUtils.getArchiveNodes()
    const req = await fetch(
      `${node.archive_node_api}/cosmos/gov/v1beta1/proposals?pagination.limit=${limit.value}&pagination.key=${pagination.value.next_key}&pagination.reverse=true&pagination.countTotal=true`
    )

    const data = await req.json()

    proposals.value = [...proposals.value, ...data.proposals]
    pagination.value = data.pagination
  } catch (error: Error | any) {
    showErrorDialog.value = true
    errorMessage.value = error?.message
  } finally {
    setTimeout(() => {
      loading.value = false
    }, 500)
  }
}

async function onClickTryAgain() {
  await fetchGovernanceProposals()
}
</script>

<style lang="scss" scoped></style>
