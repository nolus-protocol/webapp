<template>
  <DialogHeader :headerList="[$t('message.vote')]">
    <ConfirmVoteComponent
      v-if="showConfirmScreen"
      :receiverAddress="(wallet.wallet?.address as string)"
      :password="state.password"
      :txType="$t(`message.${TxType.VOTE}`) + ':'"
      :txHash="state.txHash"
      :step="step"
      :fee="state.fee"
      :onSendClick="onVoteClick"
      :onBackClick="onConfirmBackClick"
      :onOkClick="onClickOkBtn"
      :proposal="`&#35;${proposal.id} ${proposal.title ?? ''}`"
      :vote="state.vote"
      @passwordUpdate="(value) => (state.password = value)"
    />
    <template v-else>
      <div class="overflow-auto w-full md:max-h-[70vh] text-primary p-10 custom-scroll">
        <h1>&#35;{{ proposal.id }} {{ proposal.title }}</h1>
        <template v-if="!!Number(delegatedTokensAmount.amount)">
          <div class="flex flex-col gap-4">
            <button
              class="btn btn-secondary btn-large-primary"
              @click="onVote(VoteOption.VOTE_OPTION_YES)"
            >
              {{ $t('message.yes') }}
            </button>
            <button
              class="btn btn-secondary btn-large-primary"
              @click="onVote(VoteOption.VOTE_OPTION_NO)"
            >
              {{ $t('message.no') }}
            </button>

            <div class="flex gap-4">
              <button
                class="btn btn-secondary btn-large-secondary w-full"
                @click="onVote(VoteOption.VOTE_OPTION_ABSTAIN)"
              >
                {{ $t('message.abstained') }}
              </button>
              <button
                class="btn btn-secondary btn-large-secondary w-full"
                @click="onVote(VoteOption.VOTE_OPTION_NO_WITH_VETO)"
              >
                {{ $t('message.veto') }}
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
                class="block mx-auto my-0 w-10 h-7"
                src="@/assets/icons/information-circle.svg"
              />
            </template>
            <template v-slot:content>
              <span class="text-primary">
                {{ $t('message.voting-warning') }}
              </span>
            </template>
          </WarningBox>
          <button
            class="btn btn-secondary btn-large-primary"
            @click="onDelegateClick"
          >
            {{ $t('message.delegate') }}
          </button>
        </template>
      </div>
    </template>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from '@/components/modals/templates/DialogHeader.vue'
import WarningBox from '@/components/modals/templates/WarningBox.vue'
import router from '@/router'
import ConfirmVoteComponent from '@/components/modals/templates/ConfirmVoteComponent.vue'
import { inject, onMounted, type PropType, ref } from 'vue'
import { useWalletStore, WalletActionTypes } from '@/stores/wallet'
import { Dec } from '@keplr-wallet/unit'
import { type Coin, coin } from '@cosmjs/amino'
import { ErrorCodes, GAS_FEES, NATIVE_ASSET, SNACKBAR } from '@/config/env'
import { VoteOption } from 'cosmjs-types/cosmos/gov/v1beta1/gov'
import { CONFIRM_STEP, TxType } from '@/types'
import type { VoteComponentProps } from '@/types/component'
import { walletOperation } from '@/components/utils'
import { MsgVote } from 'cosmjs-types/cosmos/gov/v1beta1/tx'
import { longify } from '@cosmjs/stargate/build/queryclient'

const props = defineProps({
  proposal: {
    type: Object as PropType<{ title: string; id: string }>,
    required: true
  }
})

const wallet = useWalletStore()
const delegatedTokensAmount = ref({} as Coin);
const showConfirmScreen = ref(false);

const state = ref({
  currentBalance: wallet.balances.filter((item) => {
    if (item.balance.denom == NATIVE_ASSET.denom) {
      return true;
    }
    return false;
  }),
  password: "",
  amountErrorMsg: "",
  txHash: "",
  vote: null,
  fee: coin(GAS_FEES.vote, NATIVE_ASSET.denom),
} as VoteComponentProps);
const step = ref(CONFIRM_STEP.CONFIRM);
const closeModal = inject("onModalClose", () => () => { });
const snackbarVisible = inject("snackbarVisible", () => false);
const showSnackbar = inject("showSnackbar", (_type: string, _transaction: string) => { });
const reFetchTally = inject("reFetchTally", (id: string) => { });

onMounted(async () => {
  await loadDelegated()
})

async function loadDelegated() {
  const delegations = await wallet[WalletActionTypes.LOAD_DELEGATIONS]()
  let decimalDelegated = new Dec(0);

  for (const item of delegations) {
    const d = new Dec(item.balance.amount)
    decimalDelegated = decimalDelegated.add(d)
  }

  delegatedTokensAmount.value = coin(decimalDelegated.truncate().toString(), NATIVE_ASSET.denom)
}

const onVote = (vote: VoteOption) => {
  showConfirmScreen.value = true;
  state.value.vote = vote;
}

const onVoteClick = async () => {
  try {
    await walletOperation(onVoteEmit, state.value.password);
  } catch (error: Error | any) {
    step.value = CONFIRM_STEP.ERROR;
  }

}

const onVoteEmit = async () => {
  try {

    if (wallet.wallet && state.value.amountErrorMsg === "") {
      step.value = CONFIRM_STEP.PENDING;

      const typeUrl = "/cosmos.gov.v1beta1.MsgVote";
      const voteMsg = MsgVote.fromPartial({
        proposalId: longify(props.proposal.id),
        voter: wallet.wallet!.address,
        option: state.value.vote as VoteOption,
      });

      const { txHash, txBytes, usedFee } = await wallet.wallet!.simulateTx(voteMsg, typeUrl);
      state.value.txHash = txHash;

      if (usedFee?.amount?.[0]) {
        state.value.fee = usedFee.amount[0];
      }

      const tx = await wallet.wallet?.broadcastTx(txBytes as Uint8Array);
      const isSuccessful = tx?.code === 0;
      step.value = isSuccessful ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR;

      reFetchTally(props.proposal.id);

      if (snackbarVisible()) {
        showSnackbar(isSuccessful ? SNACKBAR.Success : SNACKBAR.Error, txHash);
      }

    }

  } catch (error: Error | any) {
    console.log(error);
    switch (error.code) {
      case (ErrorCodes.GasError): {
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

const openDialog = inject('openDialog', () => { })

const onDelegateClick = async () => {
  const url = `/earn#delegate`
  await router.push(url)
  if (url.includes('#')) {
    openDialog()
  }
}
</script>

<style lang="scss" scoped>
h1 {
  text-align: left;
  font-weight: 700;
  font-size: 18px;
  margin-bottom: 24px;
}
</style>
