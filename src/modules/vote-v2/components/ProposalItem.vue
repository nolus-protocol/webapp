<template>
  <div
    :class="wrapperClasses"
    class="proposal shadow-box flex w-full flex-col gap-3 p-5 lg:rounded-xl"
  >
    <div class="text-upper flex flex-col justify-between gap-2 text-[10px] md:flex-row md:gap-0">
      <div class="flex items-center gap-1">
        <div
          :class="{ [color.bg]: color }"
          class="h-1.5 w-1.5 rounded"
        ></div>
        <div
          :class="{ [color.text]: color }"
          class="font-medium"
        >
          <template v-if="state.voted">
            {{ $t("message.voted") }}
          </template>
          <template v-else>
            {{ ProposalStatus[state.status].split("_")[2] }}
          </template>
        </div>
      </div>
      <div
        v-if="isVotingPeriod"
        class="flex gap-2 text-light-blue"
      >
        <div>{{ $t("message.turnout") }}: {{ turnout }}%</div>
        <div>{{ $t("message.quorum") }}: {{ quorumState }}%</div>
        <div>{{ $t("message.voting-ends") }}: {{ formatDateTime(state.voting_end_time) }}</div>
      </div>
    </div>
    <div class="text-small-heading break-all text-primary">&#35;{{ state.id }} {{ state.title }}</div>
    <ProposalVotingLine
      v-if="isVotingPeriod && Object.values(state.tally).filter((res) => !!Number(res)).length > 0"
      :voting="state.tally"
    />
    <div
      v-if="state.summary"
      class="text-14 text-medium-blue"
    >
      <div class="text-bold">Summary</div>
      {{ StringUtils.truncateText(state.summary, 256) }}
    </div>
    <button
      v-if="state.summary && state.summary.length > 256"
      class="btn btn-secondary btn-medium-secondary self-start !py-1 !text-12"
      @click="$emit('read-more', { title: state.title, summary: state.summary })"
    >
      {{ $t("message.read-more") }}
    </button>

    <div
      v-if="isVotingPeriod"
      class="flex flex-col gap-3"
    >
      <div class="border-standart w-full border-b bg-transparent"></div>
      <button
        class="btn btn-primary btn-large-primary self-end !px-3 !py-2"
        @click="$emit('vote', state)"
      >
        {{ $t("message.vote") }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { type FinalTallyResult, type Proposal, ProposalStatus } from "@/modules/vote-v2/types";
import { computed, type PropType } from "vue";
import { formatDateTime, StringUtils } from "@/common/utils";
import { Dec } from "@keplr-wallet/unit";

// import ProposalVotingLine from "@/modules/vote/components/ProposalVotingLine.vue";

const props = defineProps({
  state: {
    type: Object as PropType<Proposal>,
    required: true
  },
  bondedTokens: {
    type: Object as PropType<Dec>,
    required: true
  },
  quorum: {
    type: Object as PropType<Dec>,
    required: true
  }
});

const turnout = computed(() => {
  if (props.bondedTokens.isZero()) {
    return 0;
  }

  let tally = new Dec(0);

  for (const key in props.state.tally) {
    tally = tally.add(new Dec(props.state.tally[key as keyof FinalTallyResult]));
  }

  return tally.quo(props.bondedTokens).mul(new Dec(100)).toString(2);
});

const quorumState = computed(() => {
  return props.quorum.mul(new Dec(100)).toString(2);
});

const color = computed(() => {
  switch (props.state.status) {
    case ProposalStatus.PROPOSAL_STATUS_PASSED:
      return { bg: "bg-dark-green", text: "text-[#1AB171]" };
    case ProposalStatus.PROPOSAL_STATUS_REJECTED || ProposalStatus.PROPOSAL_STATUS_FAILED:
      return { bg: "bg-[#E42929]", text: "text-[#E42929]" };
    case ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD: {
      if (props.state.voted) {
        return { bg: "bg-dark-green", text: "text-[#1AB171]" };
      }
      return { bg: "bg-light-electric", text: "text-[#2868E1]" };
    }
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
