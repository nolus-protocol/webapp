<template>
  <div
    :class="wrapperClasses"
    class="proposal w-full flex flex-col shadow-box lg:rounded-xl p-5 gap-3"
  >
    <!-- Status -->
    <div class="flex flex-col md:flex-row gap-2 md:gap-0 justify-between text-[8px] text-upper">
      <div class="flex items-center gap-1">
        <div :class="{ [color.bg]: color }" class="w-1.5 h-1.5 rounded" />
        <div :class="{ [color.text]: color }" class="font-medium">
          {{ ProposalStatus[state.status].split('_')[2] }}
        </div>
      </div>
      <div v-if="isVotingPeriod" class="flex gap-2 text-light-blue">
        <div>turnout:</div>
        <div>quorum:</div>
        <div>voting ends: {{ DateUtils.formatDateTime(state.voting_end_time) }}</div>
      </div>
    </div>
    <!-- Title -->
    <div class="text-primary text-small-heading break-all">
      #{{ state.proposal_id }} {{ state.content.title }}
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
      @click="
        $emit('read-more', { title: state.content.title, description: state.content.description })
      "
    >
      {{ $t('message.read-more') }}
    </button>

    <div v-if="isVotingPeriod">
      <div class="flex flex-col gap-3">
        <div class="w-full border-standart border-b bg-transparent" />
        <button
          class="btn btn-primary btn-large-primary self-end !px-3 !py-2"
          @click="$emit('vote', state.proposal_id)"
        >
          {{ $t('message.vote') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, type PropType } from 'vue'
import { DateUtils, StringUtils } from '@/utils'
import { type Proposal, ProposalStatus } from '@/types/Proposal'

const props = defineProps({
  state: {
    type: Object as PropType<Proposal>,
    required: true
  }
})

const color = computed(() => {
  switch (props.state.status) {
    case ProposalStatus.PROPOSAL_STATUS_PASSED:
      return { bg: 'bg-dark-green', text: 'text-[#1AB171]' }
    case ProposalStatus.PROPOSAL_STATUS_REJECTED || ProposalStatus.PROPOSAL_STATUS_FAILED:
      return { bg: 'bg-[#E42929]', text: 'text-[#E42929]' }
    case ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD:
      return { bg: 'bg-light-electric', text: 'text-[#2868E1]' }
    default:
      return { bg: 'bg-light-electric', text: 'text-[#2868E1]' }
  }
})

const isVotingPeriod = computed(() => {
  return props.state.status === ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD
})

const wrapperClasses = computed(() =>
  isVotingPeriod.value ? ['background'] : ['bg-transparent', 'lg:w-[calc(50%-10px)]']
)

const emit = defineEmits(['vote', 'read-more'])
</script>

<style lang="scss" scoped>
.proposal {
  outline: none;
  position: relative;
}

.proposal::after {
  content: '';
  position: absolute;
  top: 0px;
  right: 0px;
  bottom: 0px;
  left: 0px;
  border: 1px solid #2d3748;
  border-radius: 12px;
  pointer-events: none;
}
</style>
