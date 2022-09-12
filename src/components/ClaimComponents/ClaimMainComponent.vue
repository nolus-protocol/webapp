<template>
  <ConfirmComponent v-if="showConfirmScreen"
                    :selectedCurrency="state.selectedCurrency"
                    :receiverAddress="state.receiverAddress"
                    :password="state.password"
                    :amount="amount"
                    :txType="TxType.CLAIM"
                    :txHash="state.txHash"
                    :step="step"
                    :onSendClick="onClickClaim"
                    :onBackClick="onConfirmBackClick"
                    :onOkClick="onClickOkBtn"
                    @passwordUpdate="(value) => state.password = value"
  />
</template>

<script lang="ts" setup>
import { computed, defineProps, inject, ref } from 'vue'

import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue'
import { useStore } from '@/store'
import { CONFIRM_STEP } from '@/types/ConfirmStep'
import { TxType } from '@/types/TxType'
import { LPP_CONSTANTS } from '@/config/contracts'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import { AssetBalance } from '@/store/modules/wallet/state'
import { ClaimComponentProps } from '@/types/component/ClaimComponentProps'

const {
  amount,
  selectedAsset
} = defineProps({
  amount: {
    type: String
  },
  selectedAsset: {
    type: String,
    required: true
  }
})

// @TODO: Fetch supplied balances instead of wallet balances
const balances = computed(() => useStore().state.wallet.balances)
const selectedCurrency = computed(() => balances.value.find(asset => asset.balance.denom === selectedAsset) || balances.value[0])

const showConfirmScreen = ref(true)

const state = ref({
  currentDepositBalance: {} as AssetBalance,
  currentBalance: balances.value,
  selectedCurrency: selectedCurrency.value,
  receiverAddress: LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()][selectedCurrency.value.balance.denom].instance,
  amount: '',
  password: '',
  amountErrorMsg: '',
  txHash: '',
  onNextClick: () => onNextClick(),
  onSendClick: () => onClickClaim(),
  onConfirmBackClick: () => onConfirmBackClick(),
  onClickOkBtn: () => onClickOkBtn()
} as ClaimComponentProps)

// onMounted(async () => {
// })

const step = ref(CONFIRM_STEP.CONFIRM)

const closeModal = inject('onModalClose', () => () => {
})

function onNextClick () {
  if (!state.value.receiverAddress) {
    // TODO show error dialog
    return
  }

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

async function onClickClaim () {

}
</script>
