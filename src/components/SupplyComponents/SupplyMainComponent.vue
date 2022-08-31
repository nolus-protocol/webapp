<template>
  <ConfirmComponent v-if="showConfirmScreen"
                    :selectedCurrency="balances[0]"
                    :receiverAddress="state.receiverAddress"
                    :password="state.password"
                    :amount="state.amount"
                    :txType="TxType.SUPPLY"
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
import { computed, defineProps, inject, ref, watch } from 'vue'

import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue'
import SupplyFormComponent from '@/components/SupplyComponents/SupplyFormComponent.vue'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { useStore } from '@/store'
import { WalletUtils } from '@/utils/WalletUtils'
import { validateAmount } from '@/components/utils'
import { CONFIRM_STEP } from '@/types/ConfirmStep'
import { SupplyFormComponentProps } from '@/types/component/SupplyFormComponentProps'
import { TxType } from '@/types/TxType'
import { Dec, Int } from '@keplr-wallet/unit'
import { ChainConstants } from '@nolus/nolusjs/build/constants'
import { NolusClient } from '@nolus/nolusjs'
import { Lease } from '@nolus/nolusjs/build/contracts'
import { CONTRACTS } from '@/config/contracts'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'

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
  receiverAddress: CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance, // @TODO: Add supply address here
  txHash: '',
  onNextClick: () => onNextClick()
} as SupplyFormComponentProps)

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
  state.value.amountErrorMsg = validateAmount(
    state.value.amount,
    state.value.selectedCurrency.balance.denom,
    Number(state.value.selectedCurrency.balance.amount)
  )
}

async function onSupplyClick () {
  console.log('onSupply click')
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
  const wallet = useStore().getters.getNolusWallet
  if (wallet && state.value.amountErrorMsg === '') {
    step.value = CONFIRM_STEP.PENDING
    const coinDecimals = new Int(10).pow(new Int(6).absUInt())
    const feeAmount = new Dec('0.25').mul(new Dec(coinDecimals))
    const DEFAULT_FEE = {
      amount: [{
        denom: ChainConstants.COIN_MINIMAL_DENOM,
        amount: WalletUtils.isConnectedViaExtension() ? '0.25' : feeAmount.truncate().toString()
      }],
      gas: '2000000'
    }
    try {
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
      const leaseClient = new Lease(cosmWasmClient)
      const result = await leaseClient.lenderDeposit(
        CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance,
        wallet,
        DEFAULT_FEE,
        [{
          denom: state.value.selectedCurrency.balance.denom,
          amount: state.value.amount
        }]
      )
      if (result) {
        state.value.txHash = result.transactionHash || ''
        step.value = CONFIRM_STEP.SUCCESS
      }
    } catch (e) {
      step.value = CONFIRM_STEP.ERROR
    }
  }
}

watch(() => [...state.value.amount], (currentValue, oldValue) => {
  validateInputs()
})

watch(() => [...state.value.selectedCurrency.balance.denom.toString()], (currentValue, oldValue) => {
  validateInputs()
})

</script>
