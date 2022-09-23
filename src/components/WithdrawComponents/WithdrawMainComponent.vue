<template>
  <ConfirmComponent v-if="showConfirmScreen"
                    :selectedCurrency="state.selectedCurrency"
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
  <Modal v-if="errorDialog.showDialog" @close-modal="errorDialog.showDialog = false">
    <ErrorDialog title="Error connecting" :message="errorDialog.errorMessage" :try-button="errorDialog.tryAgain"/>
  </Modal>
</template>

<script lang="ts" setup>
import { computed, defineProps, inject, onMounted, PropType, ref, watch } from 'vue'

import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue'
import WithdrawFormComponent from '@/components/WithdrawComponents/WithdrawFormComponent.vue'
import ErrorDialog from '@/components/modals/ErrorDialog.vue'
import Modal from '@/components/modals/templates/Modal.vue'
import { useStore } from '@/store'
import { CONFIRM_STEP } from '@/types/ConfirmStep'
import { WithdrawFormComponentProps } from '@/types/component/WithdrawFormComponentProps'
import { TxType } from '@/types/TxType'
import { Coin, Int } from '@keplr-wallet/unit'
import { NolusClient } from '@nolus/nolusjs'
import { Lpp } from '@nolus/nolusjs/build/contracts'
import { LPP_CONSTANTS } from '@/config/contracts'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import { validateAmount, walletOperation } from '@/components/utils'
import { AssetBalance } from '@/store/modules/wallet/state'
import { defaultNolusWalletFee } from '@/config/wallet'

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
  currentDepositBalance: {} as AssetBalance,
  currentBalance: balances.value,
  selectedCurrency: selectedCurrency.value,
  receiverAddress: LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()][selectedCurrency.value.balance.denom].instance,
  amount: '',
  password: '',
  amountErrorMsg: '',
  txHash: '',
  onNextClick: () => onNextClick(),
  onSendClick: () => onWithdrawClick(),
  onConfirmBackClick: () => onConfirmBackClick(),
  onClickOkBtn: () => onClickOkBtn()
} as WithdrawFormComponentProps)

const errorDialog = ref({
  showDialog: false,
  errorMessage: '',
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  tryAgain: (): void => {}
})

const fetchDepositBalance = async () => {
  try {
    const walletAddress = useStore().state.wallet.wallet?.address
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
    const lppClient = new Lpp(cosmWasmClient, state.value.receiverAddress)
    const depositBalance = await lppClient.getLenderDeposit(walletAddress as string)

    state.value.currentDepositBalance = {
      balance: new Coin(state.value.selectedCurrency.balance.denom, new Int(depositBalance.balance))
    } as AssetBalance
  } catch (e: any) {
    errorDialog.value.showDialog = true
    errorDialog.value.errorMessage = e.message
    errorDialog.value.tryAgain = await fetchDepositBalance
  }
}

onMounted(async () => {
  fetchDepositBalance()
})

watch(() => [...state.value.amount], (currentValue, oldValue) => {
  validateInputs()
})

watch(() => [...state.value.selectedCurrency.balance.denom.toString()], (currentValue, oldValue) => {
  validateInputs()
  fetchDepositBalance()
  state.value.receiverAddress = LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()][state.value.selectedCurrency.balance.denom]?.instance || ''
})

const step = ref(CONFIRM_STEP.CONFIRM)

const closeModal = inject('onModalClose', () => () => {
})

function onNextClick () {
  if (!state.value.receiverAddress) {
    errorDialog.value.showDialog = true
    errorDialog.value.errorMessage = 'Missing receiver address!'
    errorDialog.value.tryAgain = hideErrorDialog
    return
  }
  validateInputs()

  if (!state.value.amountErrorMsg) {
    showConfirmScreen.value = true
  }
}

function hideErrorDialog () {
  errorDialog.value.showDialog = false
  errorDialog.value.errorMessage = ''
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
    Number(state.value.currentDepositBalance.balance.amount)
  )
}

async function onWithdrawClick () {
  await walletOperation(transferAmount, state.value.password)
}

async function transferAmount () {
  const wallet = useStore().getters.getNolusWallet
  if (wallet && state.value.amountErrorMsg === '') {
    step.value = CONFIRM_STEP.PENDING
    try {
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
      const lppClient = new Lpp(cosmWasmClient, LPP_CONSTANTS[EnvNetworkUtils.getStoredNetworkName()][state.value.selectedCurrency.balance.denom].instance)
      const result = await lppClient.burnDeposit(
        wallet,
        state.value.amount,
        defaultNolusWalletFee(),
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
</script>
