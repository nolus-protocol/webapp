<template>
  <ConfirmComponent v-if="showConfirmScreen"
                    :selectedCurrency="balances[0]"
                    :receiverAddress="state.receiverAddress"
                    :password="state.password"
                    :amount="state.amount"
                    :txType="TxType.WITHDRAW"
                    :txHash="state.txHash"
                    :step="step"
                    :onSendClick="onWithdrawClick"
                    :onBackClick="onConfirmBackClick"
                    :onOkClick="onClickOkBtn"
                    @passwordUpdate="(value) => state.password = value"
  />
  <!-- @TODO: Refactor to use <WithdrawFormComponent /> directly -->
  <component v-else :is="WithdrawFormComponent" v-model="state"/>
</template>

<script lang="ts" setup>
import { computed, defineProps, inject, ref } from 'vue'

import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue'
import WithdrawFormComponent from '@/components/WithdrawComponents/WithdrawFormComponent.vue'
import { useStore } from '@/store'
import { CONFIRM_STEP } from '@/types/ConfirmStep'
import { WithdrawFormComponentProps } from '@/types/component/WithdrawFormComponentProps'
import { TxType } from '@/types/TxType'

const { selectedAsset } = defineProps({
  selectedAsset: {
    type: String,
    required: true
  }
})

// @TODO: Fetch supplied balances instead of wallet balances
const balances = computed(() => useStore().state.wallet.balances)
const selectedCurrency = computed(() => balances.value.find(asset => asset.balance.denom === selectedAsset) || balances.value[0])

const showConfirmScreen = ref(false)
const state = ref({
  currentBalance: balances.value,
  selectedCurrency: selectedCurrency.value,
  receiverAddress: 'Withdraw address', // @TODO: Add withdraw address
  amount: '',
  password: '',
  amountErrorMsg: '',
  txHash: '',
  onNextClick: () => onNextClick(),
  onSendClick: () => onWithdrawClick(),
  onConfirmBackClick: () => onConfirmBackClick(),
  onClickOkBtn: () => onClickOkBtn()
} as WithdrawFormComponentProps)

const step = ref(CONFIRM_STEP.CONFIRM)

const closeModal = inject('onModalClose', () => () => {
})

function onNextClick () {
  validateInputs()

  if (!state.value.amountErrorMsg) {
    showConfirmScreen.value = true
  }
}

function onConfirmBackClick () {
  showConfirmScreen.value = false
}

function onClickOkBtn () {
  closeModal()
}

function validateInputs () {
}

async function onWithdrawClick () {
  step.value = CONFIRM_STEP.PENDING
  // @TODO: Implement withdraw

  // Mocked request
  setTimeout(() => {
    const success = false
    const txHash = 'test hash'
    step.value = success ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR
    state.value.txHash = txHash
  }, 3000)
}
</script>
