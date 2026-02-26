<template>
  <Dialog
    ref="dialog"
    show-close
    :title="`&#35;${proposal.id} ${proposal.title}`"
  >
    <template v-slot:content>
      <div
        class="flex flex-col gap-y-3 px-6 pb-6"
        v-if="isVotingPeriod"
      >
        <div class="flex gap-3">
          <div>
            <span class="block text-14 text-typography-secondary">{{ $t("message.turnout") }}</span>
            <span class="text-16 font-semibold text-typography-default">{{ turnout }}%</span>
          </div>
          <div>
            <span class="block text-14 text-typography-secondary">{{ $t("message.quorum") }}</span>
            <span class="text-16 font-semibold text-typography-default">{{ quorum }}%</span>
          </div>
          <div>
            <span class="block text-14 text-typography-secondary">{{ $t("message.voting-ends") }}</span>
            <span class="text-16 font-semibold text-typography-default">{{
              formatDateTime(proposal.voting_end_time)
            }}</span>
          </div>
        </div>

        <VotingLine
          v-if="
            isVotingPeriod && proposal.tally && Object.values(proposal.tally).filter((res) => !!Number(res)).length > 0
          "
          :voting="proposal.tally"
          :labels
        />
      </div>
      <div
        class="thin-scroll proposal-modal w-full overflow-auto px-6 pb-6 text-left text-typography-default"
        v-html="description"
      ></div>
    </template>
    <template
      v-slot:footer
      v-if="hasDelegatedTokens && isVotingPeriod"
    >
      <div class="flex gap-3">
        <Button
          :label="$t('message.yes')"
          icon="thumb-up"
          iconPosition="left"
          severity="primary"
          size="medium"
          @click="onVote(VoteOption.VOTE_OPTION_YES)"
          class="flex-1"
          :disabled="isDisabled"
          :loading="isLoading == VoteOption.VOTE_OPTION_YES"
        />
        <Button
          :label="$t('message.no')"
          icon="thumb-down"
          iconPosition="left"
          severity="danger"
          size="medium"
          @click="onVote(VoteOption.VOTE_OPTION_NO)"
          class="flex-1"
          :disabled="isDisabled"
          :loading="isLoading == VoteOption.VOTE_OPTION_NO"
        />
        <Button
          :label="$t('message.abstained')"
          severity="secondary"
          size="medium"
          @click="onVote(VoteOption.VOTE_OPTION_ABSTAIN)"
          class="flex-1"
          :disabled="isDisabled"
          :loading="isLoading == VoteOption.VOTE_OPTION_ABSTAIN"
        />
        <Button
          :label="$t('message.veto')"
          severity="danger"
          size="medium"
          @click="onVote(VoteOption.VOTE_OPTION_NO_WITH_VETO)"
          class="flex-1"
          :disabled="isDisabled"
          :loading="isLoading == VoteOption.VOTE_OPTION_NO_WITH_VETO"
        />
      </div>
      <p class="mt-4 text-center text-12 text-typography-secondary">
        {{ $t("message.estimate-time") }} ~{{ NATIVE_NETWORK.voteEstimation }}{{ $t("message.sec") }}
      </p>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { computed, inject, onBeforeUnmount, ref, watch } from "vue";
import { parseMarkdownSafe } from "@/common/utils/sanitize";
import type { FinalTallyResult, Proposal } from "@/modules/vote/types";
import { Dec } from "@keplr-wallet/unit";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1beta1/gov";
import { Button, Dialog, ProposalStatus, ToastType } from "web-components";
import VotingLine from "./VotingLine.vue";
import { NATIVE_NETWORK } from "../../../config/global/network";

import { formatDateTime, Logger, walletOperation } from "@/common/utils";
import { useWalletStore } from "@/common/stores/wallet";
import { useStakingStore } from "@/common/stores/staking";
import { useHistoryStore } from "@/common/stores/history";
import { MsgVote } from "cosmjs-types/cosmos/gov/v1beta1/tx";
import { useI18n } from "vue-i18n";

const dialog = ref<typeof Dialog | null>(null);
const description = ref();
const quorum = ref("");
const turnout = ref("");
const isVotingPeriod = ref(false);
const isDisabled = ref(false);
const isLoading = ref(-1);
const wallet = useWalletStore();
const stakingStore = useStakingStore();
const historyStore = useHistoryStore();
const i18n = useI18n();
const props = defineProps<{
  proposal: Proposal;
  bondedTokens: Dec | any;
  quorumTokens: Dec | any;
}>();

const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});
const labels = ref({
  yes_count: i18n.t(`message.yes_count`),
  abstain_count: i18n.t(`message.abstain_count`),
  no_count: i18n.t(`message.no_count`),
  no_with_veto_count: i18n.t(`message.no_with_veto_count`)
});

onBeforeUnmount(() => {
  hide();
});

// Check if user has delegated tokens (can vote)
const hasDelegatedTokens = computed(() => {
  const totalStaked = new Dec(stakingStore.totalStaked);
  return totalStaked.isPositive();
});

watch(
  () => props.proposal,
  async () => {
    isVotingPeriod.value = (props.proposal.status as ProposalStatus) === ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD;
    description.value = parseMarkdownSafe(props.proposal.summary);

    quorum.value = props.quorumTokens.mul(new Dec(100)).toString(2);
  },
  { immediate: true }
);

watch(
  () => [props.bondedTokens, props.proposal.tally],
  () => {
    if (props.bondedTokens.isZero()) {
      turnout.value = "0";
      return;
    }

    let tally = new Dec(0);

    for (const key in props.proposal.tally) {
      tally = tally.add(new Dec(props.proposal.tally[key as keyof FinalTallyResult]));
    }

    turnout.value = tally.quo(props.bondedTokens).mul(new Dec(100)).toString(2);
  },
  { immediate: true }
);

async function onVote(vote: VoteOption) {
  try {
    isDisabled.value = true;
    await walletOperation(() => onVoteEmit(vote));
  } catch (error: unknown) {
    Logger.error(error);
  } finally {
    isDisabled.value = false;
  }
}

async function onVoteEmit(vote: VoteOption) {
  try {
    isLoading.value = vote;
    isDisabled.value = true;

    if (wallet.wallet) {
      const typeUrl = "/cosmos.gov.v1beta1.MsgVote";
      const voteMsg = MsgVote.fromPartial({
        proposalId: BigInt(props.proposal.id),
        voter: wallet.wallet!.address,
        option: vote
      });

      const { txBytes } = await wallet.wallet!.simulateTx(voteMsg, typeUrl);

      await wallet.wallet?.broadcastTx(txBytes as Uint8Array);
      hide();
      historyStore.loadActivities();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.vote-successful", {
          proposal: props.proposal.id
        })
      });
    }
  } catch (e: unknown) {
    Logger.error(e);
  } finally {
    isLoading.value = -1;
    isDisabled.value = false;
  }
}

function show() {
  dialog.value?.show?.();
}
function hide() {
  dialog.value?.close();
}

defineExpose({ show, hide });
</script>

<style lang="scss">
.proposal-modal {
  line-height: 2;

  strong {
    font-weight: 600;
  }

  p {
    margin-bottom: 1rem;
    text-align: left;
    font-size: 16px;
    line-height: 22px;
  }

  h1 {
    margin-bottom: 0.75rem;
    margin-top: 1.5rem;
    text-align: left;
    font-size: 24px;
    line-height: 32px;
    font-weight: 600;
    &:first-child {
      margin-top: 0;
    }
  }

  h2 {
    margin-bottom: 0.75rem;
    margin-top: 1.25rem;
    text-align: left;
    font-size: 18px;
    line-height: 26px;
    font-weight: 600;
    &:first-child {
      margin-top: 0;
    }
  }

  h3 {
    margin-bottom: 0.5rem;
    margin-top: 1rem;
    text-align: left;
    font-size: 16px;
    line-height: 22px;
    font-weight: 600;
    &:first-child {
      margin-top: 0;
    }
  }

  ul,
  ol {
    margin-bottom: 1rem;
    padding-left: 2rem;
  }

  ul {
    list-style: disc;
  }

  ol {
    list-style: decimal;
  }

  li {
    margin-bottom: 0.5rem;
    font-size: 16px;
    line-height: 22px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  a {
    color: var(--color-primary-default);
    transition-property: color;
    transition-duration: 200ms;

    &:hover {
      text-decoration-line: underline;
    }
  }
}
</style>
