<template>
  <component :is="components[currentComponent]" v-model="currentComponentProps" :step="step"/>
</template>

<script lang="ts" setup>
import { inject, ref, computed } from 'vue'

import SendComponent, { SendComponentProps } from '@/components/SendComponents/SendComponent.vue'
import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { WalletUtils } from '@/utils/WalletUtils'
import { transferCurrency, validateAmount, validateAddress } from '@/components/utils'

enum ScreenState {
  MAIN = 'SendComponent',
  CONFIRM = 'ConfirmComponent'
}

const components = {
  [ScreenState.MAIN]: SendComponent,
  [ScreenState.CONFIRM]: ConfirmComponent
}

const step = ref(1)

const closeModal = inject('onModalClose', () => () => {})

const balances = computed(() => useStore().state.wallet.balances)

const currentComponent = ref(ScreenState.MAIN)
const currentComponentProps = ref({
    currentBalance: balances.value,
    selectedCurrency: balances.value[0],
    amount: '',
    memo: '',
    receiverAddress: '',
    password: '',
    onNextClick: () => onNextClick(),
    receiverErrorMsg: '',
    amountErrorMsg: '',
    txHash: '',
    onSendClick: () => onSendClick(),
    onConfirmBackClick: () => onConfirmBackClick(),
    onClickOkBtn: () => onClickOkBtn()
  } as SendComponentProps)

function onConfirmBackClick () {
  currentComponent.value = ScreenState.MAIN
}

function onClickOkBtn () {
  closeModal()
}

function onNextClick () {
  step.value = 3
  validateInputs()

  if (!currentComponentProps.value.amountErrorMsg && !currentComponentProps.value.receiverErrorMsg) {
    currentComponent.value = ScreenState.CONFIRM
    step.value = 2
  }
}

function validateInputs () {
  currentComponentProps.value.amountErrorMsg = validateAmount(
    currentComponentProps.value.amount,
    currentComponentProps.value.selectedCurrency.balance.denom,
    Number(currentComponentProps.value.selectedCurrency.balance.amount)
  )

  currentComponentProps.value.receiverErrorMsg = validateAddress(
    currentComponentProps.value.receiverAddress
  )
}

async function onSendClick () {
  const wallet = useStore().state.wallet.wallet
  if (!wallet) {
    if (WalletUtils.isConnectedViaMnemonic()) {
      useStore()
        .dispatch(WalletActionTypes.LOAD_PRIVATE_KEY_AND_SIGN, {
          password: currentComponentProps.value.password

        })
        .then(() => {
          transferAmount()
          step.value = 3
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
  const { success, txHash } = await transferCurrency(
    currentComponentProps.value.selectedCurrency.balance.denom,
    currentComponentProps.value.amount,
    currentComponentProps.value.receiverAddress
  )

  success ? step.value = 4 : step.value = 3
  currentComponentProps.value.txHash = txHash
}
</script>
