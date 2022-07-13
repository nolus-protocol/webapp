<template>
  <component :is="currentComponent.is" v-model="currentComponent.props"/>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { StarIcon } from '@heroicons/vue/solid'
import { AssetBalance } from '@/store/modules/wallet/state'
import LeaseFormComponent, { LeaseComponentProps } from '@/components/LeaseComponents/LeaseFormComponent.vue'
import { useStore } from '@/store'
import { Lease, LeaseApply } from '@nolus/nolusjs/build/contracts'
import { CONTRACTS } from '@/config/contracts'
import { Coin, Dec, Int } from '@keplr-wallet/unit'
import { WalletUtils } from '@/utils/WalletUtils'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { CurrencyUtils } from '@nolus/nolusjs'
import { assetsInfo } from '@/config/assetsInfo'
import LeaseFailedComponent from '@/components/LeaseComponents/LeaseFailedComponent.vue'
import LeaseSuccessComponent from '@/components/LeaseComponents/LeaseSuccessComponent.vue'
import LeaseConfirmComponent from '@/components/LeaseComponents/LeaseConfirmComponent.vue'

enum ScreenState {
  MAIN = 'LeaseFormComponent',
  CONFIRM = 'LeaseConfirmComponent',
  SUCCESS = 'LeaseSuccessComponent',
  FAILED = 'LeaseFailedComponent',
}

interface LeaseMainComponentData {
  is: string;
  props: LeaseComponentProps;
}

export interface SendMainComponentProps {
  onClose: () => void;
}

export default defineComponent({
  name: 'LeaseMainComponent',
  components: {
    StarIcon,
    LeaseFormComponent,
    LeaseConfirmComponent,
    LeaseSuccessComponent,
    LeaseFailedComponent
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
    // default down payment currency. TODO Change when unolus is ready!

    console.log('balances lease: ', balances)
    if (balances) {
      this.currentComponent.props.currentBalance = balances
    }
  },
  data () {
    return {
      currentComponent: {} as LeaseMainComponentData,
      leaseApplyResponse: null || ({} as LeaseApply),
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
    },
    async 'currentComponent.props.downPayment' () {
      const downPaymentAmount = this.currentComponent.props.downPayment
      if (downPaymentAmount) {
        this.currentComponent.props.downPayment = new Dec(downPaymentAmount).truncate().toString()

        if (this.isDownPaymentAmountValid()) {
          if (this.leaseContract) {
            const makeLeaseApplyResp = await this.leaseContract.makeLeaseApply(
              CONTRACTS.leaser.instance,
              this.currentComponent.props.downPayment,
              this.currentComponent.props.selectedDownPaymentCurrency.balance.denom
            )
            console.log(makeLeaseApplyResp)
            this.currentComponent.props.leaseApply = makeLeaseApplyResp
            this.populateBorrow(makeLeaseApplyResp)
          }
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
        contractAddress: CONTRACTS.leaser.instance,
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
        leaseApply: null,
        onSendClick: () => this.onSendClick(),
        onConfirmBackClick: () => this.onConfirmBackClick(),
        onClickOkBtn: () => this.onClickOkBtn()
      } as LeaseComponentProps
    },
    async onNextClick () {
      if (this.isAmountValid() && this.isDownPaymentAmountValid()) {
        this.currentComponent.is = ScreenState.CONFIRM
      }
    },
    async onSendClick () {
      const wallet = useStore().state.wallet.wallet
      if (!wallet) {
        if (WalletUtils.isConnectedViaMnemonic()) {
          if (this.isPasswordValid()) {
            useStore().dispatch(WalletActionTypes.LOAD_PRIVATE_KEY_AND_SIGN, { password: this.currentComponent.props.password })
              .then(() => {
                this.openLease()
              })
          }
        } else {
          await useStore().dispatch(WalletActionTypes.CONNECT_KEPLR)
          await this.openLease()
        }
      } else {
        await this.openLease()
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

      if (amount || amount !== '') {
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
      this.currentComponent.props.selectedCurrency = this.getCurrentBalanceByDenom(leaseApplyData.borrow.denom)
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
        const coinDecimals = new Int(10).pow(new Int(6).absUInt())
        const feeAmount = new Dec('0.25').mul(new Dec(coinDecimals))
        console.log('feeAmount: ', feeAmount.truncate().toString())
        const DEFAULT_FEE = {
          amount: [{
            denom: 'unolus',
            amount: WalletUtils.isConnectedViaExtension() ? '0.25' : feeAmount.truncate().toString()
          }],
          gas: '2000000'
        }
        try {
          const execResult = await useStore().dispatch(
            WalletActionTypes.OPEN_LEASE,
            {
              denom: this.currentComponent.props.selectedCurrency.balance.denom,
              fee: DEFAULT_FEE,
              funds: [{
                denom: this.currentComponent.props.selectedCurrency.balance.denom,
                amount: this.currentComponent.props.amount
              }]
            }
          )
          if (execResult) {
            console.log('execResult: ', execResult)
            this.currentComponent.is = ScreenState.SUCCESS
          }
        } catch (e) {
          this.currentComponent.is = ScreenState.FAILED
        }
      }
    }
  }
})
</script>
