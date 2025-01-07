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
            <span class="block text-14 text-typography-secondary">Turnout</span>
            <span class="text-16 font-semibold text-typography-default">{{ turnout }}</span>
          </div>
          <div>
            <span class="block text-14 text-typography-secondary">Quorum</span>
            <span class="text-16 font-semibold text-typography-default">{{ quorum }}</span>
          </div>
          <div>
            <span class="block text-14 text-typography-secondary">Voting ends</span>
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
        />
      </div>
      <div
        class="thin-scroll proposal-modal w-full overflow-auto px-6 pb-6 text-left text-typography-default md:max-h-[40vh]"
        v-html="description"
      ></div>
    </template>
    <template
      v-slot:footer
      v-if="!!Number(delegatedTokensAmount.amount) && isVotingPeriod"
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
        />
        <Button
          :label="$t('message.no')"
          icon="thumb-down"
          iconPosition="left"
          severity="danger"
          size="medium"
          @click="onVote(VoteOption.VOTE_OPTION_NO)"
          class="flex-1"
        />
        <Button
          :label="$t('message.abstained')"
          severity="secondary"
          size="medium"
          @click="onVote(VoteOption.VOTE_OPTION_ABSTAIN)"
          class="flex-1"
        />
        <Button
          :label="$t('message.veto')"
          severity="danger"
          size="medium"
          @click="onVote(VoteOption.VOTE_OPTION_NO_WITH_VETO)"
          class="flex-1"
        />
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { onMounted, provide, ref, watch } from "vue";
import { marked } from "marked";
import { type Coin, coin } from "@cosmjs/amino";
import { Dec } from "@keplr-wallet/unit";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1beta1/gov";
import { Button, Dialog, ProposalStatus, ProposalVotingLine } from "web-components";

import { GAS_FEES, NATIVE_ASSET } from "@/config/global";
import { formatDateTime, NetworkUtils } from "@/common/utils";
import { useWalletStore } from "@/common/stores/wallet";

import type { FinalTallyResult, Proposal, VoteComponentProps } from "@/modules/vote/types";

const dialog = ref<typeof Dialog | null>(null);
const wallet = useWalletStore();
const delegatedTokensAmount = ref({} as Coin);
const description = ref();
const quorum = ref("");
const turnout = ref("");
const isVotingPeriod = ref(false);

const state = ref({
  currentBalance: wallet.balances.filter((item) => {
    return item.balance.denom == NATIVE_ASSET.denom;
  }),
  amountErrorMsg: "",
  txHash: "",
  vote: null,
  fee: coin(GAS_FEES.vote, NATIVE_ASSET.denom)
} as VoteComponentProps);

const props = defineProps<{
  proposal: Proposal;
  bondedTokens: Dec | any;
  quorumTokens: Dec | any;
}>();

onMounted(async () => {
  await loadDelegated();
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
  () => props.proposal,
  async () => {
    isVotingPeriod.value = (props.proposal.status as ProposalStatus) === ProposalStatus.PROPOSAL_STATUS_VOTING_PERIOD;

    description.value = marked.parse(props.proposal.summary, {
      pedantic: true,
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

const onVote = (vote: VoteOption) => {
  state.value.vote = vote;
};

const show = () => dialog.value?.show();
const hide = () => dialog.value?.hide();

provide("show", show);
provide("hide", hide);

defineExpose({ show, hide });
</script>

<style lang="scss">
.proposal-modal {
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
