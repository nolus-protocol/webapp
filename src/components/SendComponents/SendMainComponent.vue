<template>
  <ConfirmComponent v-if="showConfirmScreen"
                    :selectedCurrency="balances[0]"
                    :receiverAddress="state.receiverAddress"
                    :password="state.password"
                    :amount="state.amount"
                    :memo="state.memo"
                    :txType="TxType.SEND"
                    :txHash="state.txHash"
                    :step="step"
                    :onSendClick="onSendClick"
                    :onBackClick="onConfirmBackClick"
                    :onOkClick="onClickOkBtn"
                    @passwordUpdate="(value) => state.password = value"
  />
  <!-- @TODO: Refactor to use <SendComponent /> directly -->
  <component v-else :is="SendComponent" v-model="state"/>
</template>

<script lang="ts" setup>
import { computed, inject, ref } from 'vue'

import SendComponent from '@/components/SendComponents/SendComponent.vue'
import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { WalletUtils } from '@/utils/WalletUtils'
import { transferCurrency, validateAddress, validateAmount } from '@/components/utils'
import { CONFIRM_STEP } from '@/types/ConfirmStep'
import { SendComponentProps } from '@/types/component/SendComponentProps'
import { TxType } from '@/types/TxType'

const step = ref(CONFIRM_STEP.CONFIRM)

const closeModal = inject('onModalClose', () => () => {
})

const balances = computed(() => useStore().state.wallet.balances)

const showConfirmScreen = ref(false)
const state = ref({
  currentBalance: balances.value,
  selectedCurrency: balances.value[0],
  amount: '',
  memo: '',
  receiverAddress: '',
  password: '',
  onNextClick: () => onNextClick(),
  receiverErrorMsg: '',
  amountErrorMsg: '',
  txHash: ''
} as SendComponentProps)

function onConfirmBackClick () {
  showConfirmScreen.value = false
}

function onClickOkBtn () {
  closeModal()
}

function onNextClick () {
  validateInputs()

  if (!state.value.amountErrorMsg && !state.value.receiverErrorMsg) {
    showConfirmScreen.value = true
  }
}

function validateInputs () {
  state.value.amountErrorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency.balance.denom,
    Number(state.value.selectedCurrency.balance.amount)
  )

  state.value.receiverErrorMsg = validateAddress(
    state.value.receiverAddress
  )
}

async function onSendClick () {
  const wallet = useStore().state.wallet.wallet
  if (!wallet) {
    if (WalletUtils.isConnectedViaMnemonic()) {
      useStore()
        .dispatch(WalletActionTypes.LOAD_PRIVATE_KEY_AND_SIGN, {
          password: state.value.password

        })
        .then(() => {
          transferAmount()
        })
    } else {
      useStore().dispatch(WalletActionTypes.CONNECT_KEPLR)
      await transferAmount()
    }
  } else {
    transferAmount()
  }
}

async function transferAmount () {
  step.value = CONFIRM_STEP.PENDING
  const {
    success,
    txHash
  } = await transferCurrency(
    state.value.selectedCurrency.balance.denom,
    state.value.amount,
    state.value.receiverAddress,
    state.value.memo
  )

  step.value = success ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR
  state.value.txHash = txHash
}
</script>
