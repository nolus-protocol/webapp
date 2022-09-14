<template>
  <ConfirmComponent v-if="showConfirmScreen"
                    :selectedCurrency="currentComponent.props.selectedCurrency"
                    :receiverAddress="currentComponent.props.contractAddress"
                    :password="currentComponent.props.password"
                    :amount="currentComponent.props.amount"
                    :memo="currentComponent.props.memo"
                    :txType="TX_TYPE.LEASE"
                    :txHash="currentComponent.props.txHash"
                    :step="step"
                    :onSendClick="onSendClick"
                    :onBackClick="onConfirmBackClick"
                    :onOkClick="onClickOkBtn"
                    @passwordUpdate="(value: string) => currentComponent.props.password = value"
  />
  <!-- @TODO: Refactor to use <LeaseFormComponent /> directly -->
  <component v-else :is="currentComponent.is" v-model="currentComponent.props"/>
</template>

<!-- @TODO: Transition component to Composition API -->
<script lang="ts">
import { defineComponent } from 'vue'
import { StarIcon } from '@heroicons/vue/solid'
import { LeaseApply, Leaser } from '@nolus/nolusjs/build/contracts'
import { CurrencyUtils, NolusClient } from '@nolus/nolusjs'
import { Coin, Dec, Int } from '@keplr-wallet/unit'

import { AssetBalance } from '@/store/modules/wallet/state'
import LeaseFormComponent from '@/components/LeaseComponents/LeaseFormComponent.vue'
import { useStore } from '@/store'
import { CONTRACTS } from '@/config/contracts'
import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import { assetsInfo } from '@/config/assetsInfo'
import { CONFIRM_STEP } from '@/types/ConfirmStep'
import { TxType } from '@/types/TxType'
import { LeaseComponentProps } from '@/types/component/LeaseComponentProps'
import { defaultNolusWalletFee } from '@/config/wallet'
import { walletOperation } from '@/components/utils'

interface LeaseMainComponentData {
  is: string;
  props: LeaseComponentProps;
}

export default defineComponent({
  name: 'LeaseMainComponent',
  components: {
    StarIcon,
    LeaseFormComponent,
    ConfirmComponent
  },
  emits: [],
  inject: {
    onModalClose: {
      default: () => () => {
      }
    },
    getLeases: {
      default: () => () => {
      }
    }
  },
  mounted () {
    const balances = useStore().state.wallet.balances
    this.currentComponent = {
      is: 'LeaseFormComponent',
      props: this.initProps()
    }
    if (balances) {
      this.currentComponent.props.currentBalance = balances
      this.currentComponent.props.selectedCurrency = balances[0]
    }
  },
  data () {
    return {
      step: CONFIRM_STEP.CONFIRM,
      TX_TYPE: TxType,
      showConfirmScreen: false,
      currentComponent: {} as LeaseMainComponentData,
      leaseApplyResponse: null || ({} as LeaseApply),
      leaserContract: {} as Leaser,
      closeModal: this.onModalClose,
      updateLeases: this.getLeases
    }
  },
  watch: {
    '$store.state.wallet.balances' (balances: AssetBalance[]) {
      if (balances) {
        this.currentComponent.props.currentBalance = balances

        if (!this.currentComponent.props.selectedCurrency) {
          this.currentComponent.props.selectedCurrency = balances[0]
        }
      }
    },
    async 'currentComponent.props.amount' () {
      const amount = this.currentComponent.props.amount
      if (amount) {
        this.currentComponent.props.amount = new Dec(amount).truncate().toString()
        this.isAmountValid()
      }
    },
    async 'currentComponent.props.downPayment' () {
      const downPaymentAmount = this.currentComponent.props.downPayment
      if (downPaymentAmount) {
        this.currentComponent.props.downPayment = new Dec(downPaymentAmount).truncate().toString()

        if (this.isDownPaymentAmountValid()) {
          const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
          const leaserClient = new Leaser(cosmWasmClient, CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance)
          const makeLeaseApplyResp = await leaserClient.leaseQuote(
            this.currentComponent.props.downPayment,
            this.currentComponent.props.selectedDownPaymentCurrency.balance.denom
          )
          console.log(makeLeaseApplyResp)
          this.currentComponent.props.leaseApply = makeLeaseApplyResp
          this.populateBorrow(makeLeaseApplyResp)
        }
      } else {
        this.currentComponent.props.amount = ''
        this.currentComponent.props.leaseApply = null
      }
    }
  },
  methods: {
    initProps () {
      return {
        contractAddress: CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance,
        currentBalance: [] as AssetBalance[],
        selectedDownPaymentCurrency: {
          balance: new Coin(
            'ibc/8A34AF0C1943FD0DFCDE9ADBF0B2C9959C45E87E6088EA2FC6ADACD59261B8A2',
            0
          )
        } as AssetBalance,
        selectedCurrency: {} as AssetBalance,
        downPayment: '',
        amount: '',
        memo: '',
        password: '',
        passwordErrorMsg: '',
        onNextClick: () => this.onNextClick(),
        receiverErrorMsg: '',
        amountErrorMsg: '',
        downPaymentErrorMsg: '',
        txHash: '',
        leaseApply: null
      } as LeaseComponentProps
    },
    async onNextClick () {
      if (this.isAmountValid() && this.isDownPaymentAmountValid()) {
        this.showConfirmScreen = true
      }
    },
    async onSendClick () {
      await walletOperation(this.openLease, this.currentComponent.props.password)
    },
    onConfirmBackClick () {
      this.showConfirmScreen = false
    },
    onClickOkBtn () {
      this.closeModal()
    },
    isPasswordValid (): boolean {
      let isValid = true
      const passwordField = this.currentComponent.props.password
      this.currentComponent.props.passwordErrorMsg = ''

      if (!passwordField) {
        isValid = false
        this.currentComponent.props.passwordErrorMsg = 'Please enter password'
      }

      return isValid
    },
    isDownPaymentAmountValid (): boolean {
      let isValid = true
      const selectedDownPaymentDenom = this.currentComponent.props.selectedDownPaymentCurrency.balance.denom
      const downPaymentAmount = this.currentComponent.props.downPayment
      const currentBalance = this.getCurrentBalanceByDenom(selectedDownPaymentDenom)

      if (downPaymentAmount || downPaymentAmount !== '') {
        const decimals = assetsInfo[currentBalance.balance.denom].coinDecimals
        this.currentComponent.props.downPaymentErrorMsg = ''
        const downPaymentAmountInMinimalDenom = CurrencyUtils.convertDenomToMinimalDenom(
          downPaymentAmount,
          '',
          decimals
        )
        const isLowerThanOrEqualsToZero = new Dec(
          downPaymentAmountInMinimalDenom.amount || '0'
        ).lte(new Dec(0))
        const isGreaterThanWalletBalance = new Int(
          downPaymentAmountInMinimalDenom.amount.toString() || '0'
        ).gt(currentBalance.balance.amount)
        if (isLowerThanOrEqualsToZero) {
          this.currentComponent.props.downPaymentErrorMsg = 'balance is too low'
          isValid = false
        }
        if (isGreaterThanWalletBalance) {
          this.currentComponent.props.downPaymentErrorMsg = 'balance is too big'
          isValid = false
        }
      } else {
        this.currentComponent.props.downPaymentErrorMsg = 'missing amount value'
        isValid = false
      }

      return isValid
    },
    isAmountValid (): boolean {
      let isValid = true
      const amount = this.currentComponent.props.amount
      const leaseBorrowAmount = this.currentComponent.props.leaseApply?.borrow?.amount

      if (!leaseBorrowAmount) {
        isValid = false
      }

      if (isValid && (amount || amount !== '')) {
        this.currentComponent.props.amountErrorMsg = ''
        const isLowerThanOrEqualsToZero = new Int(amount).lt(new Int(1))
        const isGreaterThenBorrow = new Int(amount).gt(new Int(leaseBorrowAmount || ''))

        if (isLowerThanOrEqualsToZero) {
          this.currentComponent.props.amountErrorMsg = 'balance is too low'
          isValid = false
        }
        if (isGreaterThenBorrow) {
          this.currentComponent.props.amountErrorMsg = 'balance is too big'
          isValid = false
        }
      } else {
        this.currentComponent.props.amountErrorMsg = 'missing amount value'
        isValid = false
      }

      return isValid
    },
    populateBorrow (leaseApplyData: LeaseApply) {
      if (!leaseApplyData) {
        return
      }
      this.currentComponent.props.amount = leaseApplyData.borrow.amount
      // this.currentComponent.props.selectedCurrency = this.changeSelectedCurrency(leaseApplyData.borrow.denom)
      this.currentComponent.props.selectedCurrency = this.getCurrentBalanceByDenom(leaseApplyData.borrow.symbol)
    },
    getCurrentBalanceByDenom (denom: string) {
      let result: AssetBalance = {} as AssetBalance
      this.currentComponent.props.currentBalance.forEach((assetBalance) => {
        if (assetBalance.balance.denom === denom) {
          result = assetBalance as AssetBalance
        }
      })
      return result
    },
    async openLease () {
      const wallet = useStore().getters.getNolusWallet
      if (wallet && this.isAmountValid()) {
        this.step = CONFIRM_STEP.PENDING
        try {
          const funds = [{
            denom: this.currentComponent.props.selectedCurrency.balance.denom,
            amount: this.currentComponent.props.amount
          }]
          const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
          const leaserClient = new Leaser(cosmWasmClient, CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance)
          const result = await leaserClient.openLease(
            wallet,
            this.currentComponent.props.selectedCurrency.balance.denom,
            defaultNolusWalletFee(),
            funds)
          if (result) {
            this.currentComponent.props.txHash = result.transactionHash || ''
            this.step = CONFIRM_STEP.SUCCESS
          }
        } catch (e) {
          this.step = CONFIRM_STEP.ERROR
        }
      }
    }
  }
})
</script>
