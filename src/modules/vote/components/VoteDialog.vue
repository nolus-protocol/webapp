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

        <ProposalVotingLine
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
    <template v-slot:footer>
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
import { inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { marked } from "marked";
import { type Coin, coin } from "@cosmjs/amino";
import type { FinalTallyResult, Proposal } from "@/modules/vote/types";
import { Dec } from "@keplr-wallet/unit";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1beta1/gov";
import { Button, Dialog, ProposalStatus, ProposalVotingLine, ToastType } from "web-components";
import { NATIVE_NETWORK } from "../../../config/global/network";

import { NATIVE_ASSET } from "@/config/global";
import { formatDateTime, Logger, NetworkUtils, walletOperation } from "@/common/utils";
import { useWalletStore } from "@/common/stores/wallet";
import { MsgVote } from "cosmjs-types/cosmos/gov/v1/tx";
import { longify } from "@cosmjs/stargate/build/queryclient";
import { useI18n } from "vue-i18n";

const dialog = ref<typeof Dialog | null>(null);
const delegatedTokensAmount = ref({} as Coin);
const description = ref();
const quorum = ref("");
const turnout = ref("");
const isVotingPeriod = ref(false);
const isDisabled = ref(false);
const isLoading = ref(-1);
const wallet = useWalletStore();
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

onMounted(async () => {
  await loadDelegated();
});

onBeforeUnmount(() => {
  hide();
});

async function loadDelegated() {
  const delegations = await NetworkUtils.loadDelegations();
  let decimalDelegated = new Dec(0);

  for (const item of delegations) {
    const d = new Dec(item.balance.amount);
    decimalDelegated = decimalDelegated.add(d);
  }

  delegatedTokensAmount.value = coin(decimalDelegated.truncate().toString(), NATIVE_ASSET.denom);
}

watch(
  () => wallet.wallet,
  () => {
    loadDelegated();
  }
);

watch(
  () => props.proposal,
  async () => {
    isVotingPeriod.value = (props.proposal.status as ProposalStatus) === ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD;
    description.value = marked.parse(props.proposal.summary, {
      pedantic: false,
      gfm: true,
      breaks: true
    });

    quorum.value = props.quorumTokens.mul(new Dec(100)).toString(2);
  }
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
  }
);

async function onVote(vote: VoteOption) {
  try {
    isDisabled.value = true;
    await walletOperation(() => onVoteEmit(vote));
  } catch (error: Error | any) {
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
        proposalId: longify(props.proposal.id),
        voter: wallet.wallet!.address,
        option: vote
      });

      const { txHash, txBytes, usedFee } = await wallet.wallet!.simulateTx(voteMsg, typeUrl);

      await wallet.wallet?.broadcastTx(txBytes as Uint8Array);
      hide();
      wallet.loadActivities();
      onShowToast({
        type: ToastType.success,
        message: i18n.t("message.vote-successful", {
          proposal: props.proposal.id
        })
      });
    }
  } catch (error: Error | any) {
    Logger.error(error);
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
  ul {
    padding-left: 32px;
  }
  strong {
    @apply font-semibold;
  }

  p {
    @apply mb-4 text-left text-16;

    &.strong {
      @apply font-semibold;
    }
  }

  ul {
    margin-bottom: 18px;
    list-style: unset;
  }

  h1 {
    @apply mb-3 text-left text-24 font-semibold;
  }

  h2 {
    @apply mb-3 text-left text-18 font-semibold;
  }

  a {
    transition: ease 200ms;
    @apply text-primary-default;

    &.link {
      @apply text-primary-default;
    }
  }

  a:hover {
    @apply text-primary-default;
  }
}
</style>
