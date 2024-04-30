<template>
  <ProposalItem
    :id="state.id"
    :class="wrapperClasses"
    :quorum="quorumState"
    :read-more-button-text="$t('message.read-more')"
    :status="state.status"
    :summary="StringUtils.truncateText(state.summary, 256)"
    :tally="state.tally"
    :title="state.title"
    :turnout="turnout"
    :voteButtonText="$t('message.vote')"
    :voted="!state.voted"
    :voting_end_time="formatDateTime(state.voting_end_time)"
    @vote="$emit('vote', state)"
    @read-more="$emit('read-more', { title: state.title, summary: state.summary })"
  />
</template>

<script lang="ts" setup>
import { type FinalTallyResult, type Proposal, ProposalStatus } from "@/modules/vote/types";
import { computed, type PropType } from "vue";
import { Dec } from "@keplr-wallet/unit";
import { formatDateTime, StringUtils } from "@/common/utils";

import { Proposal as ProposalItem } from "web-components";

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

const isVotingPeriod = computed(() => {
  return props.state.status === ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD;
});

const wrapperClasses = computed(() => (isVotingPeriod.value ? ["background"] : ["lg:w-[calc(50%-10px)]"]));

defineEmits(["vote", "read-more"]);
</script>

<style lang="scss" scoped></style>
