<template>
  <div :class="{ 'animate-pulse': !initialLoad }" class="block">
    <template v-if="initialLoad && !showSkeleton">
      <TransitionGroup appear name="fade-long">
        <ProposalItem v-for="(proposal, index) in proposals" :key="index" :state="proposal" />
      </TransitionGroup>
      <div class="text-center mt-6 lg:mt-8">
        <button
          v-if="visible"
          :class="{ 'js-loading': loading }"
          class="btn btn-secondary btn-medium-secondary mx-auto"
          @click="load"
        >
          {{ $t('message.load-more') }}
        </button>
      </div>
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
import ProposalItem from '@/components/vote/ProposalItem.vue'

const loading = ref(false)
const initialLoad = ref(false)
const showSkeleton = ref(true)
const proposals = ref([] as Proposal[])
const limit = ref(3)
const pagination = ref({
  total: 0,
  next_key: ''
})
let timeout: NodeJS.Timeout

onMounted(async () => {
  console.log('Component is mounted!')
  await fetchGovernance()
  timeout = setTimeout(() => {
    showSkeleton.value = false
  }, 400)
})

onUnmounted(() => {
  if (timeout) {
    clearTimeout(timeout)
  }
})

const fetchGovernance = async () => {
  try {
    const node = await AppUtils.getArchiveNodes()
    const req = await fetch(
      `${node.archive_node_api}/cosmos/gov/v1beta1/proposals?pagination.limit=${limit.value}&pagination.countTotal=true&pagination.reverse=true`
    )

    // /cosmos/gov/v1beta1/proposals?proposalStatus=PROPOSAL_STATUS_VOTING_PERIOD&pagination.limit=${limit.value}&pagination.countTotal=true&pagination.reverse=true
    // /cosmos/gov/v1beta1/proposals?proposalStatus=PROPOSAL_STATUS_VOTING_PERIOD&pagination.limit=2&pagination.countTotal=true&pagination.reverse=true
    const data = await req.json()

    proposals.value = data.proposals
    pagination.value = data.pagination

    console.info({ proposals: proposals.value, pagination: pagination.value })

    initialLoad.value = true
  } catch (error) {
    console.error(error)
  }
}

const visible = computed(() => {
  return initialLoad.value && pagination.value.total > limit.value
})
</script>

<style lang="scss" scoped></style>
