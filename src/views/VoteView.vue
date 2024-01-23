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
      <Modal v-if="showReadMoreModal" route="create" @close-modal="onCloseReadMoreModal">
        <ProposalReadMoreDialog :source="proposal.description" :title="proposal.title" />
      </Modal>
      <Modal v-if="showVoteModal" route="create" @close-modal="onCloseVoteModal">
        <div>Vote Modal</div>
      </Modal>
    </template>
    <template v-else>
      <div v-for="index in 2" :key="index" class="h-[400px] md:h-[290px]">
        <div class="flex justify-between">
          <div class="w-[30px] h-0.5 bg-grey"></div>
          <div class="w-[300px] h-0.5 bg-grey"></div>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { AppUtils } from '@/utils/AppUtils'
import type { Proposal } from '@/types/Proposal'
import ProposalItem from '@/modules/vote/components/ProposalItem.vue'
import ProposalReadMoreDialog from '@/modules/vote/components/ProposalReadMoreDialog.vue'
import Modal from '@/components/modals/templates/Modal.vue'

const showReadMoreModal = ref(false)
const showVoteModal = ref(false)
const loading = ref(false)
const initialLoad = ref(false)
const showSkeleton = ref(true)
const proposals = ref([] as Proposal[])
const proposal = ref({
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
  timeout = setTimeout(() => {
    showSkeleton.value = false
  }, 400)
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

    console.info({ proposals: proposals.value, pagination: pagination.value })

    initialLoad.value = true
  } catch (error) {
    console.error(error)
  }
}

const onReadMore = ({ description, title }: { description: string; title: string }) => {
  showReadMoreModal.value = true
  proposal.value = {
    description,
    title
  }
}

const onCloseReadMoreModal = () => {
  showReadMoreModal.value = false
}

const onCloseVoteModal = () => {
  showVoteModal.value = false
}

const onVote = (proposalId: string) => {
  console.log('onVote', proposalId)
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
  } catch (e) {
    console.error(e)
  } finally {
    setTimeout(() => {
      loading.value = false
    }, 500)
  }
}
</script>

<style lang="scss" scoped></style>
