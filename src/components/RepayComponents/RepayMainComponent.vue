<template>
  <div
    class="fixed flex modal items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 z-[99]"
    style="linear-gradient(314.47 deg, #EBEFF5 2.19 %, #F7F9FC 100 %);"
  >
    <div
      class="text-center modal bg-white w-full max-w-[516px] radius-modal mx-auto shadow-modal"
      @click.stop
    >
      <button class="btn-close-modal" @click="$emit('close-modal')">
        <img class="inline-block w-4 h-4" src="@/assets/icons/cross.svg"/>
      </button>
      <div class="flex modal-header">
        <p class="nls-32 nls-font-700">{{ $t('message.repay') }}</p>
      </div>

  <component :is="currentComponent.is" v-model="currentComponent.props"  :step="step"/>
  </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { StarIcon } from '@heroicons/vue/solid'
import { AssetBalance } from '@/store/modules/wallet/state'
import RepayFormComponent, { RepayComponentProps } from '@/components/RepayComponents/RepayFormComponent.vue'
import { useStore } from '@/store'
import { Lease } from '@nolus/nolusjs/build/contracts'
import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue';
import { LeaseData } from '@/types/LeaseData'
import { Dec, Int } from '@keplr-wallet/unit'
import { WalletUtils } from '@/utils/WalletUtils'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { CurrencyUtils } from '@nolus/nolusjs'
import { assetsInfo } from '@/config/assetsInfo'

enum ScreenState {
  MAIN = 'RepayFormComponent',
  CONFIRM = 'ConfirmComponent'
}

interface RepayMainComponentData {
  is: string;
  props: RepayComponentProps;
}

export interface SendMainComponentProps {
  onClose: () => void;
  leaseData: LeaseData
}

export default defineComponent({
  name: 'RepayMainComponent',
  components: {
    StarIcon,
    RepayFormComponent,
    ConfirmComponent
  },
  props: {
    modelValue: {
      type: Object as PropType<SendMainComponentProps>
    }
  },
  mounted () {
    const balances = useStore().state.wallet.balances
    this.leaseContract = new Lease()
    this.currentComponent = {
      is: ScreenState.MAIN,
      props: this.initProps()
    }

    if (balances) {
      this.currentComponent.props.currentBalance = balances
    }
  },
  data () {
    return {
      step: 1 as number,
      currentComponent: {} as RepayMainComponentData,
      leaseContract: {} as Lease
    }
  },
  watch: {
    '$store.state.wallet.balances' (balances: AssetBalance[]) {
      if (balances) {
        this.currentComponent.props.currentBalance = balances
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
        outstandingLoanAmount: this.modelValue?.leaseData?.leaseStatus?.amount || '',
        currentBalance: [] as AssetBalance[],
        selectedCurrency: {} as AssetBalance,
        receiverAddress: this.modelValue?.leaseData.leaseAddress || '',
        amount: '',
        password: '',
        passwordErrorMsg: '',
        amountErrorMsg: '',
        txHash: '',
        onNextClick: () => this.onNextClick(),
        onSendClick: () => this.onSendClick(),
        onConfirmBackClick: () => this.onConfirmBackClick(),
        onClickOkBtn: () => this.onClickOkBtn()
      } as RepayComponentProps
    },
    async onNextClick () {
      if (this.isAmountValid()) {
        this.currentComponent.is = ScreenState.CONFIRM
        this.step = 2;
      }
    },
    async onSendClick () {
      if(this.step == 2) {
        this.step = 3;
      const wallet = useStore().state.wallet.wallet
      if (!wallet) {
        if (WalletUtils.isConnectedViaMnemonic()) {
          if (this.isPasswordValid()) {
            useStore().dispatch(WalletActionTypes.LOAD_PRIVATE_KEY_AND_SIGN, { password: this.currentComponent.props.password })
              .then(() => {
                this.repayLease()
              })
          }
        } else {
          await useStore().dispatch(WalletActionTypes.CONNECT_KEPLR)
          await this.repayLease()
        }
      } else {
        await this.repayLease()
      }
      } else {
        this.onClickOkBtn()
      }
    },
    onConfirmBackClick () {
      this.currentComponent.is = ScreenState.MAIN
    },
    onClickOkBtn () {
      this.resetData()
      this.modelValue?.onClose()
    },
    resetData () {
      this.currentComponent = {
        is: ScreenState.MAIN,
        props: this.initProps()
      }
    },
    isAmountValid (): boolean {
      let isValid = true
      const decimals = assetsInfo[this.currentComponent.props.selectedCurrency.balance.denom].coinDecimals
      const amount = this.currentComponent.props.amount
      const microAmount = CurrencyUtils.convertDenomToMinimalDenom(amount, this.currentComponent.props.selectedCurrency.balance.denom, decimals).amount.toString()
      const walletBalance = String(
        this.currentComponent.props.selectedCurrency?.balance?.amount || 0
      )

      console.log('<<wallet: ', walletBalance)

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
        const coinDecimals = new Int(10).pow(new Int(6).absUInt())
        const feeAmount = new Dec('0.25').mul(new Dec(coinDecimals))
        const DEFAULT_FEE = {
          amount: [{
            denom: 'unolus',
            amount: WalletUtils.isConnectedViaExtension() ? '0.25' : feeAmount.truncate().toString()
          }],
          gas: '2000000'
        }
        try {
          const execResult = await useStore().dispatch(
            WalletActionTypes.REPAY_LEASE,
            {
              contractAddress: this.currentComponent.props.receiverAddress,
              denom: this.currentComponent.props.selectedCurrency.balance.denom,
              fee: DEFAULT_FEE,
              funds: [{
                denom: this.currentComponent.props.selectedCurrency.balance.denom,
                amount: this.currentComponent.props.amount
              }]
            }
          )
          if (execResult) {
            this.step = 3;
          }
        } catch (e) {
          this.step = 4
        }
      }
    }
  }
})
</script>
