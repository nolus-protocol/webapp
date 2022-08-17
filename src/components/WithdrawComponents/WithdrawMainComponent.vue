<template>
  <component :is="components[currentComponent]" v-model="currentComponentProps" :step="step"/>
</template>

<script lang="ts" setup>
import { ref, computed, inject } from 'vue'

import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue'
import WithdrawFormComponent, { WithdrawFormComponentProps } from '@/components/WithdrawComponents/WithdrawFormComponent.vue'
import { useStore } from '@/store'

enum ScreenState {
  FORM = 'WithdrawFormComponent',
  CONFIRM = 'ConfirmComponent'
}

const components = {
  [ScreenState.FORM]: WithdrawFormComponent,
  [ScreenState.CONFIRM]: ConfirmComponent
}

const { selectedAsset } = defineProps({
  selectedAsset: {
    type: String,
    required: true
  }
})

// @TODO: Fetch supplied balances instead of wallet balances
const balances = computed(() => useStore().state.wallet.balances)
const selectedCurrency = computed(() => balances.value.find(asset => asset.balance.denom === selectedAsset) || balances.value[0])

const currentComponent = ref(ScreenState.FORM)
const currentComponentProps = ref({
    currentBalance: balances.value,
    selectedCurrency: selectedCurrency.value,
    amount: '',
    password: '',
    amountErrorMsg: '',
    txHash: '',
    onNextClick: () => onNextClick(),
    onSendClick: () => onWithdrawClick(),
    onConfirmBackClick: () => onConfirmBackClick(),
    onClickOkBtn: () => onClickOkBtn()
  } as WithdrawFormComponentProps)

const step = ref(1)

const closeModal = inject('onModalClose', () => () => {})

function onNextClick () {
  step.value = 3
  validateInputs()

  if (!currentComponentProps.value.amountErrorMsg) {
    currentComponent.value = ScreenState.CONFIRM
    step.value = 2
  }
}

function onConfirmBackClick () {
  currentComponent.value = ScreenState.FORM
}

function onClickOkBtn () {
  closeModal()
}

function validateInputs () {}

async function onWithdrawClick () {}
</script>
