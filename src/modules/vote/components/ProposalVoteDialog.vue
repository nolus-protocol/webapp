<template>
  <DialogHeader :headerList="[$t('message.vote')]">
    <ConfirmVoteComponent
      v-if="showConfirmScreen"
      :fee="state.fee"
      :onBackClick="onConfirmBackClick"
      :onOkClick="onClickOkBtn"
      :onSendClick="onVoteClick"
      :proposal="`&#35;${proposal.id} ${proposal.title ?? ''}`"
      :receiverAddress="wallet.wallet?.address as string"
      :step="step"
      :txHash="state.txHash"
      :txType="$t(`message.${TxType.VOTE}`) + ':'"
      :vote="state.vote"
    />
    <template v-else>
      <div class="custom-scroll w-full overflow-auto p-10 text-neutral-typography-200 md:max-h-[70vh]">
        <h1>&#35;{{ proposal.id }} {{ proposal.title }}</h1>
        <template v-if="!!Number(delegatedTokensAmount.amount)">
          <div class="flex flex-col gap-4">
            <button
              class="btn btn-secondary btn-large-primary"
              @click="onVote(VoteOption.VOTE_OPTION_YES)"
            >
              {{ $t("message.yes") }}
            </button>
            <button
              class="btn btn-secondary btn-large-primary"
              @click="onVote(VoteOption.VOTE_OPTION_NO)"
            >
              {{ $t("message.no") }}
            </button>

            <div class="flex gap-4">
              <button
                class="btn btn-secondary btn-large-secondary w-full"
                @click="onVote(VoteOption.VOTE_OPTION_ABSTAIN)"
              >
                {{ $t("message.abstained") }}
              </button>
              <button
                class="btn btn-secondary btn-large-secondary w-full"
                @click="onVote(VoteOption.VOTE_OPTION_NO_WITH_VETO)"
              >
                {{ $t("message.veto") }}
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <WarningBox
            :isWarning="true"
            class="mb-6"
          >
            <template v-slot:icon>
              <img
                class="mx-auto my-0 block h-7 w-10"
                src="@/assets/icons/information-circle.svg"
              />
            </template>
            <template v-slot:content>
              <span class="text-neutral-typography-200">
                {{ $t("message.voting-warning") }}
              </span>
            </template>
          </WarningBox>
          <button
            class="btn btn-secondary btn-large-primary"
            @click="onDelegateClick"
          >
            {{ $t("message.delegate") }}
          </button>
        </template>
      </div>
    </template>
  </DialogHeader>
</template>

<script lang="ts" setup>
import { type Coin, coin } from "@cosmjs/amino";
import type { VoteComponentProps } from "@/modules/vote/types";

import DialogHeader from "@/common/components/modals/templates/DialogHeader.vue";
import WarningBox from "@/common/components/modals/templates/WarningBox.vue";
import ConfirmVoteComponent from "@/common/components/modals/templates/ConfirmVoteComponent.vue";

import { router } from "@/router";
import { inject, onMounted, type PropType, ref } from "vue";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { ErrorCodes, GAS_FEES, NATIVE_ASSET } from "@/config/global";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1/gov";
import { CONFIRM_STEP, TxType } from "@/common/types";
import { Logger, NetworkUtils, walletOperation } from "@/common/utils";
import { MsgVote } from "cosmjs-types/cosmos/gov/v1/tx";
import { longify } from "@cosmjs/stargate/build/queryclient";

const props = defineProps({
  proposal: {
    type: Object as PropType<{ title: string; id: string }>,
    required: true
  }
});

const wallet = useWalletStore();
const delegatedTokensAmount = ref({} as Coin);
const showConfirmScreen = ref(false);

const state = ref({
  currentBalance: wallet.balances.filter((item) => {
    if (item.balance.denom == NATIVE_ASSET.denom) {
      return true;
    }
    return false;
  }),
  amountErrorMsg: "",
  txHash: "",
  vote: null,
  fee: coin(GAS_FEES.vote, NATIVE_ASSET.denom)
} as VoteComponentProps);

const step = ref(CONFIRM_STEP.CONFIRM);
const closeModal = inject("onModalClose", () => () => {});
const refetchProposalData = inject("refetchProposalData", (id: string) => {});

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

function onVote(vote: VoteOption) {
  showConfirmScreen.value = true;
  state.value.vote = vote;
}

async function onVoteClick() {
  try {
    await walletOperation(onVoteEmit);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }
}

async function onVoteEmit() {
  try {
    if (wallet.wallet && state.value.amountErrorMsg === "") {
      step.value = CONFIRM_STEP.PENDING;

      const typeUrl = "/cosmos.gov.v1beta1.MsgVote";
      const voteMsg = MsgVote.fromPartial({
        proposalId: longify(props.proposal.id),
        voter: wallet.wallet!.address,
        option: state.value.vote as VoteOption
      });

      const { txHash, txBytes, usedFee } = await wallet.wallet!.simulateTx(voteMsg, typeUrl);
      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }

      const tx = await wallet.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;

      refetchProposalData(props.proposal.id);
    }
  } catch (error: Error | any) {
    Logger.error(error);
    switch (error.code) {
      case ErrorCodes.GasError: {
        step.value = CONFIRM_STEP.GasError;
        break;
      }
      default: {
        step.value = CONFIRM_STEP.ERROR;
        break;
      }
    }
  }
}

function onClickOkBtn() {
  closeModal();
}

function onConfirmBackClick() {
  showConfirmScreen.value = false;
}

async function onDelegateClick() {
  const url = `/earn#delegate`;
  await router.push(url);
  if (url.includes("#")) {
    openDialog();
  }
}

const openDialog = inject("openDialog", () => {});
</script>

<style lang="scss" scoped>
h1 {
  text-align: left;
  font-weight: 700;
  font-size: 18px;
  margin-bottom: 24px;
}
</style>
