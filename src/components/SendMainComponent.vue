<template>
  <component :is="currentSendStep"
             v-model:currentBalance="currentBalance"
             v-model:selectedCurrency="selectedCurrency"
             v-model:amount="amount"
             v-model:memo="memo"
             v-model:receiverAddress="receiverAddress"
             v-model:password="password"
             v-model:onNextClick="onNextClick"
             v-model:onSendClick="onSendClick"
             v-model:onConfirmBackClick="onConfirmBackClick"
             v-model:onClickOkBtn="onClickOkBtn"
             :receiverErrorMsg="receiverErrorMsg"
             :amountErrorMsg="amountErrorMsg"
             :txHash="this.txHash"
  />
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { StarIcon } from '@heroicons/vue/solid'
import SendingConfirmComponent from '@/components/SendingConfirmComponent.vue'
import SendComponent from '@/components/SendComponent.vue'
import SendingSuccessComponent from '@/components/SendingSuccessComponent.vue'
import SendingFailedComponent from '@/components/SendingFailedComponent.vue'
import store, { AssetBalance } from '@/store'
import { Bech32 } from '@cosmjs/encoding'
import { Dec, Int } from '@keplr-wallet/unit'
import { CurrencyUtils } from '@/utils/CurrencyUtils'

enum ScreenState {
  MAIN = 'SendComponent',
  CONFIRM = 'SendingConfirmComponent',
  SUCCESS = 'SendingSuccessComponent',
  FAILED = 'SendingFailedComponent'
}

export interface SendMainComponentProps {
  onClose: () => void
}

export default defineComponent({
  name: 'SendMainComponent',
  components: {
    StarIcon,
    SendComponent,
    SendingConfirmComponent,
    SendingSuccessComponent,
    SendingFailedComponent
  },
  props: {
    modelValue: {
      type: Object as PropType<SendMainComponentProps>
    }
  },
  data () {
    return {
      currentSendStep: ScreenState.MAIN,
      currentBalance: [] as AssetBalance[],
      selectedCurrency: {} as AssetBalance,
      amount: '',
      memo: '',
      receiverAddress: '',
      password: '',
      txHash: '',
      receiverErrorMsg: '',
      amountErrorMsg: ''
    }
  },
  watch: {
    '$store.state.balances' (balances: AssetBalance[]) {
      if (balances) {
        this.currentBalance = balances
      }
    },
    amount () {
      this.isAmountFieldValid()
      console.log('amount:', this.amount)
    },
    memo () {
      console.log('memo:', this.memo)
    },
    receiverAddress () {
      this.isReceiverAddressValid()
    }
  },
  methods: {
    reset () {
      console.log('here')
      Object.assign(this.$data, this.$options.data)
    },
    onNextClick () {
      this.isAmountFieldValid()
      this.isReceiverAddressValid()
      if (this.amountErrorMsg === '' && this.receiverErrorMsg === '') {
        this.currentSendStep = ScreenState.CONFIRM
      }
    },
    async onSendClick () {
      console.log(this.password)

      const txResponse = await store.dispatch('transferTokens', {
        receiverAddress: this.receiverAddress,
        amount: CurrencyUtils.convertNolusToUNolus(this.amount).amount.toString(),
        feeAmount: '0.25'
      })
      if (txResponse) {
        console.log('txResponse: ', txResponse)
        this.txHash = txResponse.transactionHash
        this.currentSendStep = txResponse.code === 0 ? ScreenState.SUCCESS : ScreenState.FAILED
      }
    },
    onConfirmBackClick () {
      this.currentSendStep = ScreenState.MAIN
    },
    onClickOkBtn () {
      this.resetData()
      this.modelValue?.onClose()
    },
    resetData () {
      this.amount = ''
      this.memo = ''
      this.receiverAddress = ''
      this.password = ''
      this.currentSendStep = ScreenState.MAIN
    },
    isReceiverAddressValid () {
      if (this.receiverAddress || this.receiverAddress.trim() !== '') {
        try {
          Bech32.decode(this.receiverAddress, 44)
          this.receiverErrorMsg = ''
        } catch (e) {
          console.log('address is not valid!')
          this.receiverErrorMsg = 'address is not valid!'
        }
      } else {
        console.log('missing receiver address')
        this.receiverErrorMsg = 'missing receiver address'
      }
    },
    isAmountFieldValid () {
      if (this.amount || this.amount !== '') {
        this.amountErrorMsg = ''
        const amountInUnls = CurrencyUtils.convertNolusToUNolus(this.amount)
        const walletBalance = String(this.currentBalance[0].balance.amount || 0)
        const isLowerThanOrEqualsToZero = new Dec(amountInUnls.amount || '0').lte(new Dec(0))
        const isGreaterThanWalletBalance = new Int(amountInUnls.amount.toString() || '0').gt(new Int(walletBalance))
        if (isLowerThanOrEqualsToZero) {
          console.log('balance is too low')
          this.amountErrorMsg = 'balance is too low'
        }
        if (isGreaterThanWalletBalance) {
          console.log('balance is too big')
          this.amountErrorMsg = 'balance is too big'
        }
      } else {
        this.amountErrorMsg = 'missing amount value'
      }
    }
  }
})
</script>
