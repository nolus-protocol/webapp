<template>
  <component
    :is="currentComponent.is"
    v-model="currentComponent.props"
  />
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { StarIcon } from '@heroicons/vue/solid'
import SendingConfirmComponent from '@/components/SendingConfirmComponent.vue'
import SendingSuccessComponent from '@/components/SendingSuccessComponent.vue'
import SendingFailedComponent from '@/components/SendingFailedComponent.vue'
import { AssetBalance } from '@/store/modules/wallet/state'
import LeaseFormComponent from '@/components/LeaseFormComponent.vue'
import { SendComponentProps } from '@/components/SendComponent.vue'
import { useStore } from '@/store'
import { Lease } from '@/contracts/lease/Lease'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'

enum ScreenState {
  MAIN = 'LeaseFormComponent',
  CONFIRM = 'SendingConfirmComponent',
  SUCCESS = 'SendingSuccessComponent',
  FAILED = 'SendingFailedComponent'
}

interface LeaseMainComponentData {
  is: string,
  props: SendComponentProps
}

export interface SendMainComponentProps {
  onClose: () => void
}

export default defineComponent({
  name: 'LeaseMainComponent',
  components: {
    StarIcon,
    LeaseFormComponent,
    SendingConfirmComponent,
    SendingSuccessComponent,
    SendingFailedComponent
  },
  props: {
    modelValue: {
      type: Object as PropType<SendMainComponentProps>
    }
  },
  mounted () {
    this.currentComponent = {
      is: ScreenState.MAIN,
      props: {
        currentBalance: [] as AssetBalance[],
        selectedCurrency: {} as AssetBalance,
        amount: '',
        memo: '',
        receiverAddress: '',
        password: '',
        onNextClick: () => this.onNextClick(),
        receiverErrorMsg: '',
        amountErrorMsg: '',
        txHash: '',
        onSendClick: () => this.onSendClick(),
        onConfirmBackClick: () => this.onConfirmBackClick(),
        onClickOkBtn: () => this.onClickOkBtn()
      } as SendComponentProps
    }
    const balances = useStore().state.wallet.balances

    console.log('balances lease: ', balances)
    if (balances) {
      this.currentComponent.props.currentBalance = balances
    }
  },
  data () {
    return {
      currentComponent: {} as LeaseMainComponentData
    }
  },
  watch: {
    '$store.state.wallet.balances' (balances: AssetBalance[]) {
      if (balances) {
        this.currentComponent.props.currentBalance = balances
      }
    },
    'currentComponent.props.selectedCurrency' () {
      if (this.currentComponent.props.selectedCurrency) {
        console.log('selected:', this.currentComponent.props.selectedCurrency)
      }
    }
  },
  methods: {
    async onNextClick () {
      console.log('click next')
      const wallet = useStore().state.wallet.wallet
      const leaseContract = new Lease()
      const downpayment = await leaseContract.getDownpayment(this.currentComponent.props.amount, 'unolus')

      if (!wallet) {
        useStore().dispatch(WalletActionTypes.CONNECT_KEPLR)
      }
      useStore().dispatch(WalletActionTypes.OPEN_LEASE, {
        denom: 'unolus',
        feeAmount: '0.25'
      })
      // wallet?.execute()
      console.log(downpayment)
      // console.log('selected currency: ', this.currentComponent.props.selectedCurrency)
      // console.log('how much: ', this.currentComponent.props.amount)
      // this.currentComponent.is = ScreenState.CONFIRM
      // if (this.currentComponent.props.amountErrorMsg === '' &&
      //   this.currentComponent.props.receiverErrorMsg === '') {
      //   this.currentComponent.is = ScreenState.CONFIRM
      // }
    },
    async onSendClick () {
      this.currentComponent.is = ScreenState.SUCCESS
      // console.log(this.currentComponent.props.password)
      //
      // const txResponse = await useStore().dispatch(WalletActionTypes.TRANSFER_TOKENS, {
      //   receiverAddress: this.currentComponent.props.receiverAddress,
      //   amount: CurrencyUtils.convertNolusToUNolus(this.currentComponent.props.amount).amount.toString(),
      //   feeAmount: '0.25'
      // })
      // if (txResponse) {
      //   console.log('txResponse: ', txResponse)
      //   this.currentComponent.is = txResponse.code === 0 ? ScreenState.SUCCESS : ScreenState.FAILED
      //   this.currentComponent.props.txHash = txResponse.transactionHash
      // }
    },

    onConfirmBackClick () {
      this.currentComponent.is = ScreenState.MAIN
    },
    onClickOkBtn () {
      this.resetData()
      this.modelValue?.onClose()
    },
    resetData () {
      // console.log('resetData')
      // this.currentComponent = {
      //   is: ScreenState.MAIN,
      //   props: {} as SendComponentProps
      // }
    }
  }
})
</script>
