<template>
  <div :class="wrapperClasses"
       class="proposal w-full flex flex-col shadow-box lg:rounded-xl p-5 gap-3">
    <div class="flex flex-col md:flex-row gap-2 md:gap-0 justify-between text-[10px] text-upper">
      <div class="flex items-center gap-1">
        <div :class="{ [color.bg]: color }"
             class="w-1.5 h-1.5 rounded" />
        <div :class="{ [color.text]: color }"
             class="font-medium">
          {{ ProposalStatus[state.status].split("_")[2] }}
        </div>
      </div>
      <div v-if="isVotingPeriod"
           class="flex gap-2 text-light-blue">
        <div>turnout: {{ turnout }}%</div>
        <div>quorum: {{ quorum }}%</div>
        <div>voting ends: {{ DateUtils.formatDateTime(state.voting_end_time) }}</div>
      </div>
    </div>
    <div class="text-primary text-small-heading break-all">
      &#35;{{ state.id }} {{ state.title }}
    </div>
    <ProposalVotingLine v-if="isVotingPeriod && Object.values(state.tally).filter((res) => !!Number(res)).length > 0"
                        :voting="state.tally" />
    <div v-if="state.summary"
         class="text-medium-blue text-14">
      <div class="text-bold">Summary</div>
      {{ StringUtils.truncateText(state.summary, 256) }}
    </div>
    <button v-if="state.summary && state.summary.length > 256"
            class="btn btn-secondary btn-medium-secondary self-start !text-12 !py-1"
            @click="$emit('read-more', { title: state.title, summary: state.summary })">
      {{ $t("message.read-more") }}
    </button>

    <div v-if="isVotingPeriod"
         class="flex flex-col gap-3">
      <div class="w-full border-standart border-b bg-transparent"></div>
      <button class="btn btn-primary btn-large-primary self-end !px-3 !py-2"
              @click="$emit('vote', state)">
        {{ $t("message.vote") }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, type PropType } from "vue";
import { DateUtils, StringUtils } from "@/utils";
import { type Proposal, ProposalStatus, type FinalTallyResult } from "@/modules/vote/Proposal";
import { ProposalState } from "@/modules/vote/state";
import ProposalVotingLine from "@/modules/vote/components/ProposalVotingLine.vue";
import { Dec } from "@keplr-wallet/unit";

const props = defineProps({
  state: {
    type: Object as PropType<Proposal>,
    required: true,
    default: ProposalState
  },
  bondedTokens: {
    type: Object as PropType<Dec>,
    required: true
  }
});

const turnout = computed(() => {

  if(props.bondedTokens.isZero()){
    return 0;
  }
  
  let tally = new Dec(0);

  for(const key in props.state.tally){
    tally = tally.add(new Dec(props.state.tally[key as keyof FinalTallyResult]));
  }

  return tally.quo(props.bondedTokens).mul(new Dec(100)).toString(2);
});

const quorum = computed(() => {
  const q = (Number(props.state.messages[0].params.quorum) * 100).toFixed(2);
  return q;
});

const color = computed(() => {
  switch (props.state.status) {
    case ProposalStatus.PROPOSAL_STATUS_PASSED:
      return { bg: "bg-dark-green", text: "text-[#1AB171]" };
    case ProposalStatus.PROPOSAL_STATUS_REJECTED || ProposalStatus.PROPOSAL_STATUS_FAILED:
      return { bg: "bg-[#E42929]", text: "text-[#E42929]" };
    case ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD:
      return { bg: "bg-light-electric", text: "text-[#2868E1]" };
    default:
      return { bg: "bg-light-electric", text: "text-[#2868E1]" };
  }
});

const isVotingPeriod = computed(() => {
  return props.state.status === ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD;
});

const wrapperClasses = computed(() =>
  isVotingPeriod.value ? ["background"] : ["bg-transparent", "lg:w-[calc(50%-10px)]"]
);

defineEmits(["vote", "read-more"]);
</script>

<style lang="scss" scoped>
.dark,
.sync {
  .proposal {
    outline: none;
    position: relative;
  }

  .proposal::after {
    content: "";
    position: absolute;
    top: 0px;
    right: 0px;
    bottom: 0px;
    left: 0px;
    border: 1px solid #2d3748;
    border-radius: 12px;
    pointer-events: none;
  }
}
</style>
