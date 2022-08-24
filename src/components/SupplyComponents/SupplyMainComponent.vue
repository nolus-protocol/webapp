<template>
  <ConfirmComponent v-if="showConfirmScreen"
    :selectedCurrency="balances[0]"
    :receiverAddress="state.receiverAddress"
    :password="state.password"
    :amount="state.amount"
    :txType="TX_TYPE.SUPPLY"
    :txHash="state.txHash"
    :step="step"
    :onSendClick="onSupplyClick"
    :onBackClick="onConfirmBackClick"
    :onOkClick="onClickOkBtn"
    @passwordUpdate="(value) => state.password = value"
  />
  <!-- @TODO: Refactor to use <SupplyFormComponent /> directly -->
  <component v-else :is="SupplyFormComponent" v-model="state"/>
</template>

<script lang="ts" setup>
import { ref, computed, inject } from 'vue'

import ConfirmComponent, { CONFIRM_STEP, TX_TYPE } from '@/components/modals/templates/ConfirmComponent.vue'
import SupplyFormComponent, { SupplyFormComponentProps } from '@/components/SupplyComponents/SupplyFormComponent.vue'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { useStore } from '@/store'
import { WalletUtils } from '@/utils/WalletUtils'
import { transferCurrency, validateAmount } from '@/components/utils'

const { selectedAsset } = defineProps({
  selectedAsset: {
    type: String,
    required: true
  }
})

const balances = computed(() => useStore().state.wallet.balances)
const selectedCurrency = computed(() => balances.value.find(asset => asset.balance.denom === selectedAsset) || balances.value[0])

const showConfirmScreen = ref(false)
const state = ref({
    currentBalance: balances.value,
    selectedCurrency: selectedCurrency.value,
    amount: '',
    password: '',
    amountErrorMsg: '',
    currentAPR: '24.21%', // @TODO: fetch APR
    receiverAddress: 'Missing Supply address (Nolus Market)', // @TODO: Add supply address here
    txHash: '',
    onNextClick: () => onNextClick(),
  } as SupplyFormComponentProps)

const step = ref(CONFIRM_STEP.CONFIRM)

const closeModal = inject('onModalClose', () => () => {})

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
  state.value.amountErrorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency.balance.denom,
    Number(state.value.selectedCurrency.balance.amount)
  )
}

async function onSupplyClick () {
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
  const { success, txHash } = await transferCurrency(
    state.value.selectedCurrency.balance.denom,
    state.value.amount,
    state.value.receiverAddress
  )

  step.value = success ? CONFIRM_STEP.SUCCESS : CONFIRM_STEP.ERROR
  state.value.txHash = txHash
}


</script>
