<template>
  <component :is="currentSendStep"
             v-model:currentBalance="currentBalance"
             v-model:selectedCurrency="selectedCurrency"
             v-model:amount="amount"
             v-model:memo="memo"
             v-model:sendTo="sendTo"
             v-model:password="password"
             v-model:onNextClick="onNextClick"
             v-model:onSendClick="onSendClick"
             v-model:onConfirmBackClick="onConfirmBackClick"
             v-model:onClickOkBtn="onClickOkBtn"
  />
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { StarIcon } from '@heroicons/vue/solid'
import SendingConfirmComponent from '@/components/SendingConfirmComponent.vue'
import SendComponent from '@/components/SendComponent.vue'
import SendingSuccessComponent from '@/components/SendingSuccessComponent.vue'
import SendingFailedComponent from '@/components/SendingFailedComponent.vue'
import { AssetBalance } from '@/store'

const ScreenState = Object.freeze({
  MAIN: 'SendComponent',
  CONFIRM: 'SendingConfirmComponent',
  SUCCESS: 'SendingSuccessComponent',
  FAILED: 'SendingFailedComponent'
})
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
    onClose: {
      type: Function,
      default: () => ({})
    }
  },
  data () {
    return {
      currentBalance: [] as AssetBalance[],
      selectedCurrency: {} as AssetBalance,
      amount: '',
      memo: '',
      sendTo: '',
      password: '',
      currentSendStep: ScreenState.MAIN
    }
  },
  watch: {
    '$store.state.balances' (balances: AssetBalance[]) {
      if (balances && this.currentBalance.length === 0) {
        this.currentBalance = balances
      }
    },
    amount () {
      console.log('amount:', this.amount)
    },
    memo () {
      console.log('memo:', this.memo)
    }
  },
  methods: {
    updateCurrency (value: AssetBalance) {
      this.selectedCurrency = value
    },
    onNextClick () {
      console.log('click next! ', this.selectedCurrency)
      this.currentSendStep = ScreenState.CONFIRM
    },
    onSendClick () {
      console.log(this.password)
      this.currentSendStep = ScreenState.SUCCESS
    },
    onConfirmBackClick () {
      this.currentSendStep = ScreenState.MAIN
    },
    onClickOkBtn () {
      this.resetData()
      this.onClose()
    },
    resetData () {
      this.amount = ''
      this.memo = ''
      this.sendTo = ''
      this.password = ''
      this.currentSendStep = ScreenState.MAIN
    }
  }
})
</script>
