<template>
  <ProposalItem
    class="proposal-item"
    :id="state.id"
    :quorum="quorumState"
    :read-more-button-text="$t('message.read-more')"
    :status="state.status"
    :summary="StringUtils.truncateText(`${summary}`, 256)"
    :tally="state.tally"
    :title="state.title"
    :turnout="turnout"
    :voteButtonText="$t('message.vote')"
    :voted="!state.voted"
    :voting_end_time="formatDateTime(state.voting_end_time)"
    :labels
    @actionButton="emit('actionButton', state)"
    :turnoutLabel="$t('message.turnout')"
    :quorumLabel="$t('message.quorum')"
    :votingEndsLabel="$t('message.voting-ends')"
  />
</template>

<script lang="ts" setup>
import { type FinalTallyResult, type Proposal } from "@/modules/vote/types";
import { computed, ref, type PropType } from "vue";
import { Dec } from "@keplr-wallet/unit";
import { formatDateTime, StringUtils } from "@/common/utils";

import { Proposal as ProposalItem } from "web-components";
import { parseMarkdownSafe } from "@/common/utils/sanitize";
import { useI18n } from "vue-i18n";

const props = defineProps({
  state: {
    type: Object as PropType<Proposal>,
    required: true
  },
  bondedTokens: {
    type: Object as PropType<Dec | any>,
    required: true
  },
  quorum: {
    type: Object as PropType<Dec | any>,
    required: true
  }
});
const i18n = useI18n();

const labels = ref({
  yes_count: i18n.t(`message.yes_count`),
  abstain_count: i18n.t(`message.abstain_count`),
  no_count: i18n.t(`message.no_count`),
  no_with_veto_count: i18n.t(`message.no_with_veto_count`),
  turnoutLabel: i18n.t("message.turnout"),
  quorumLabel: i18n.t("message.quorum"),
  votingEndsLabel: i18n.t("message.voting-ends")
});

const summary = computed(() => {
  return parseMarkdownSafe(props.state.summary);
});

const turnout = computed(() => {
  if (props.bondedTokens.isZero()) {
    return "0";
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

const emit = defineEmits<{
  (e: "actionButton", value: Proposal): void;
}>();
</script>

<style lang="scss">
.proposal-item {
  h2 {
    margin-bottom: 0.5rem;
    text-align: left;
    font-size: 18px;
    line-height: 26px;
    font-weight: 600;
  }
  strong {
    font-weight: 600;
  }

  // Override web-component's internal ProposalVotingLine tooltip
  // to match the app's standard Tooltip style (dark bg, proper font size)
  .bg-white.text-\[8px\] {
    border: 0;
    background-color: var(--color-background-level-inverted-2);
    font-size: 0.8125rem;
    line-height: 1rem;
    color: var(--color-inverted);

    // Remove bold/uppercase from label, keep vote color visible on dark bg
    span[class*="font-bold"] {
      font-weight: 400;
      text-transform: none;
    }
  }
}
</style>
