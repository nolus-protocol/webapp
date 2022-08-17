<template>
  <component :is="components[currentComponent]" v-model="currentComponentProps" :step="step"/>
</template>

<script lang="ts" setup>
import { ref, computed, inject } from 'vue'

import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue'
import SupplyFormComponent, { SupplyFormComponentProps } from '@/components/SupplyComponents/SupplyFormComponent.vue'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { useStore } from '@/store'
import { WalletUtils } from '@/utils/WalletUtils'
import { transferCurrency, validateAmount } from '@/components/utils'

enum ScreenState {
  FORM = 'SupplyFormComponent',
  CONFIRM = 'ConfirmComponent'
}

const components = {
  [ScreenState.FORM]: SupplyFormComponent,
  [ScreenState.CONFIRM]: ConfirmComponent
}

const { selectedAsset } = defineProps({
  selectedAsset: {
    type: String,
    required: true
  }
})

const balances = computed(() => useStore().state.wallet.balances)
const selectedCurrency = computed(() => balances.value.find(asset => asset.balance.denom === selectedAsset) || balances.value[0])

const currentComponent = ref(ScreenState.FORM)
const currentComponentProps = ref({
    currentBalance: balances.value,
    selectedCurrency: selectedCurrency.value,
    amount: '',
    password: '',
    amountErrorMsg: '',
    currentAPR: '24.21%', // @TODO: fetch APR
    receiverAddress: 'Missing Supply address (Nolus Market)', // @TODO: Add supply address here
    txHash: '',
    onNextClick: () => onNextClick(),
    onSendClick: () => onSupplyClick(),
    onConfirmBackClick: () => onConfirmBackClick(),
    onClickOkBtn: () => onClickOkBtn()
  } as SupplyFormComponentProps)

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

function validateInputs () {
  currentComponentProps.value.amountErrorMsg = validateAmount(
    currentComponentProps.value.amount,
    currentComponentProps.value.selectedCurrency.balance.denom,
    Number(currentComponentProps.value.selectedCurrency.balance.amount)
  )
}

async function onSupplyClick () {
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
