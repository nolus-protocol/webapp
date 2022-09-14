<template>
  <ConfirmComponent v-if="showConfirmScreen"
                    :selectedCurrency="currentComponent.props.selectedCurrency"
                    :receiverAddress="currentComponent.props.receiverAddress"
                    :password="currentComponent.props.password"
                    :amount="currentComponent.props.amount"
                    :txType="TX_TYPE.REPAY"
                    :txHash="currentComponent.props.txHash"
                    :step="step"
                    :onSendClick="onSendClick"
                    :onBackClick="onConfirmBackClick"
                    :onOkClick="onClickOkBtn"
                    @passwordUpdate="(value: string) => currentComponent.props.password = value"
  />
  <!-- @TODO: Refactor to use <RepayFormComponent /> directly -->
  <component v-else :is="currentComponent.is" v-model="currentComponent.props"/>
</template>

<!-- @TODO: Transition component to Composition API -->
<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { StarIcon } from '@heroicons/vue/solid'
import { Lease } from '@nolus/nolusjs/build/contracts'
import { CurrencyUtils, NolusClient, NolusWallet } from '@nolus/nolusjs'
import { ChainConstants } from '@nolus/nolusjs/build/constants'
import { Dec, Int } from '@keplr-wallet/unit'

import { AssetBalance } from '@/store/modules/wallet/state'
import RepayFormComponent from '@/components/RepayComponents/RepayFormComponent.vue'
import { useStore } from '@/store'
import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue'
import { LeaseData } from '@/types/LeaseData'
import { WalletUtils } from '@/utils/WalletUtils'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { assetsInfo } from '@/config/assetsInfo'
import { RepayComponentProps } from '@/types/component/RepayComponentProps'
import { CONFIRM_STEP } from '@/types/ConfirmStep'
import { TxType } from '@/types/TxType'
import { defaultNolusWalletFee } from '@/config/wallet'
import { Coin } from '@cosmjs/proto-signing'
import { walletOperation } from '@/components/utils'

enum ScreenState {
  MAIN = 'RepayFormComponent',
  CONFIRM = 'ConfirmComponent'
}

interface RepayMainComponentData {
  is: string;
  props: RepayComponentProps;
}

export default defineComponent({
  name: 'RepayMainComponent',
  components: {
    StarIcon,
    RepayFormComponent,
    ConfirmComponent
  },
  props: {
    leaseData: {
      type: Object as PropType<LeaseData>,
      required: true
    }
  },
  inject: {
    onModalClose: {
      default: () => () => {
      }
    }
  },
  async mounted () {
    const balances = useStore().state.wallet.balances
    this.currentComponent = {
      is: 'RepayFormComponent',
      props: this.initProps()
    }
    if (balances) {
      this.currentComponent.props.selectedCurrency = balances[0]
    }
  },
  emits: [],
  data () {
    return {
      step: CONFIRM_STEP.CONFIRM,
      showConfirmScreen: false,
      TX_TYPE: TxType,
      currentComponent: {} as RepayMainComponentData,
      closeModal: this.onModalClose
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
    }
  },
  methods: {
    initProps () {
      return {
        outstandingLoanAmount: this.leaseData?.leaseStatus?.opened?.amount || '',
        currentBalance: [] as AssetBalance[],
        selectedCurrency: {} as AssetBalance,
        receiverAddress: this.leaseData.leaseAddress || '',
        amount: '',
        password: '',
        passwordErrorMsg: '',
        amountErrorMsg: '',
        txHash: '',
        onNextClick: () => this.onNextClick()
      } as RepayComponentProps
    },
    async onNextClick () {
      if (this.isAmountValid()) {
        this.showConfirmScreen = true
      }
    },
    async onSendClick () {
      await walletOperation(this.repayLease, this.currentComponent.props.password)
    },
    onConfirmBackClick () {
      this.showConfirmScreen = false
    },
    onClickOkBtn () {
      this.closeModal()
    },
    isAmountValid (): boolean {
      let isValid = true
      const decimals = assetsInfo[this.currentComponent.props.selectedCurrency.balance.denom].coinDecimals
      const amount = this.currentComponent.props.amount
      const microAmount = CurrencyUtils.convertDenomToMinimalDenom(amount, this.currentComponent.props.selectedCurrency.balance.denom, decimals).amount.toString()
      const walletBalance = String(
        this.currentComponent.props.selectedCurrency?.balance?.amount || 0
      )

      if (microAmount || microAmount !== '') {
        this.currentComponent.props.amountErrorMsg = ''
        const isLowerThanOrEqualsToZero = new Int(microAmount).lt(new Int(1))
        const isGreaterThenBalance = new Int(microAmount).gt(new Int(walletBalance || '0'))

        if (isLowerThanOrEqualsToZero) {
          this.currentComponent.props.amountErrorMsg = 'balance is too low'
          isValid = false
        }
        if (isGreaterThenBalance) {
          this.currentComponent.props.amountErrorMsg = 'balance is too big'
          isValid = false
        }
      } else {
        this.currentComponent.props.amountErrorMsg = 'missing amount value'
        isValid = false
      }

      return isValid
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
    async repayLease () {
      const wallet = useStore().getters.getNolusWallet
      if (wallet && this.isAmountValid()) {
        this.step = CONFIRM_STEP.PENDING
        try {
          const funds: Coin[] = [{
            denom: this.currentComponent.props.selectedCurrency.balance.denom,
            amount: this.currentComponent.props.amount
          }]
          const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
          const leaseClient = new Lease(cosmWasmClient, this.currentComponent.props.receiverAddress)
          const result = await leaseClient.repayLease(wallet, defaultNolusWalletFee(), funds)

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
