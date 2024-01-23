<template>
  <div
    :class="{
      [`bg-transparent`]: !isVotingPeriod,
      [`background`]: isVotingPeriod
    }"
    class="flex flex-col mt-6 shadow-box lg:rounded-xl p-5 outline gap-3"
  >
    <!-- Status -->
    <div class="flex justify-between text-[8px] text-upper">
      <div class="flex items-center gap-1">
        <div :class="{ [`bg-${color}`]: color }" class="w-1.5 h-1.5 rounded" />
        <div :class="{ [`text-${color}`]: color }" class="font-medium">
          {{ ProposalStatus[state.status].split('_')[2] }}
        </div>
      </div>
      <div v-if="isVotingPeriod" class="hidden lg:flex gap-2 text-light-blue">
        <div>turnout:</div>
        <div>quorum:</div>
        <div>voting ends: {{ DateUtils.parseDateTime(state.voting_end_time) }}</div>
      </div>
    </div>
    <!-- Title -->
    <div class="text-primary text-small-heading">
      {{ state.content.title }}
    </div>
    <!-- Line -->
    <div>line here</div>
    <!-- Summary -->
    <div v-if="state.content.description" class="text-medium-blue text-12">
      <div class="text-bold text-14">Summary</div>
      {{ StringUtils.truncateText(state.content.description, 256) }}
    </div>
    <button
      v-if="state.content.description && state.content.description.length > 256"
      class="btn btn-secondary btn-medium-secondary self-start !text-12 !py-1"
    >
      {{ $t('message.read-more') }}
    </button>

    <div v-if="isVotingPeriod">
      <div class="flex flex-col gap-3">
        <div class="w-full border-standart border-b bg-transparent" />
        <button class="btn btn-primary btn-large-primary self-end !px-3 !py-2">
          {{ $t('message.vote') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ProposalStatus } from '@/types/Proposal'
import { computed } from 'vue'
import { DateUtils, StringUtils } from '@/utils'

const props = defineProps({
  state: {
    type: Object as PropType<Proposal>,
    required: true
  }
})

const color = computed(() => {
  switch (props.state.status) {
    case ProposalStatus.PROPOSAL_STATUS_PASSED:
      return 'dark-green'
    case ProposalStatus.PROPOSAL_STATUS_REJECTED:
      return 'light-red'
    case ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD:
      return 'light-electric'
    default:
      return 'light-electric'
  }
})

const isVotingPeriod = computed(() => {
  return props.state.status === ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD
})

console.info({ state: props.state, color: color.value })
</script>

<style lang="scss" scoped></style>
