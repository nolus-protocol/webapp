<template>
  <component :is="currentComponent.is" v-model="currentComponent.props"/>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { StarIcon } from '@heroicons/vue/solid'
import SendingConfirmComponent from '@/components/SendComponents/SendingConfirmComponent.vue'
import SendComponent, { SendComponentProps } from '@/components/SendComponents/SendComponent.vue'
import SendingSuccessComponent from '@/components/SendComponents/SendingSuccessComponent.vue'
import SendingFailedComponent from '@/components/SendComponents/SendingFailedComponent.vue'
import { Bech32 } from '@cosmjs/encoding'
import { Coin, Dec, Int } from '@keplr-wallet/unit'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { AssetBalance } from '@/store/modules/wallet/state'
import { WalletUtils } from '@/utils/WalletUtils'
import { CurrencyUtils } from '@nolus/nolusjs'
import { ChainConstants } from '@nolus/nolusjs/build/constants'

enum ScreenState {
  MAIN = 'SendComponent',
  CONFIRM = 'SendingConfirmComponent',
  SUCCESS = 'SendingSuccessComponent',
  FAILED = 'SendingFailedComponent',
}

interface SendMainComponentData {
  is: string;
  props: SendComponentProps;
}

export interface SendMainComponentProps {
  onClose: () => void;
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
  mounted () {
    this.currentComponent = {
      is: ScreenState.MAIN,
      props: this.initProps()
    }
    const balances = useStore().state.wallet.balances
    if (balances) {
      this.currentComponent.props.currentBalance = balances
    }
  },
  data () {
    return {
      currentComponent: {} as SendMainComponentData
    }
  },
  watch: {
    '$store.state.wallet.balances' (balances: AssetBalance[]) {
      if (balances) {
        this.currentComponent.props.currentBalance = balances
      }
    },
    'currentComponent.props.memo' () {
      console.log('memo:', this.currentComponent.props.memo)
    },
    'currentComponent.props.receiverAddress' () {
      if (this.currentComponent.props.receiverAddress) {
        this.isReceiverAddressValid()
      }
    },
    'currentComponent.props.amount' () {
      if (this.currentComponent.props.amount) {
        this.isAmountFieldValid()
        console.log('amount:', this.currentComponent.props.amount)
      }
    }
  },
  emits: ['defaultState'],
  methods: {
    initProps () {
      return {
        currentBalance: [] as AssetBalance[],
        selectedCurrency: { balance: new Coin(ChainConstants.COIN_MINIMAL_DENOM, new Int('0')) } as AssetBalance,
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
    },
    onNextClick () {
      this.$emit('defaultState', true)
      this.isAmountFieldValid()
      this.isReceiverAddressValid()
      if (
        this.currentComponent.props.amountErrorMsg === '' &&
        this.currentComponent.props.receiverErrorMsg === ''
      ) {
        this.currentComponent.is = ScreenState.CONFIRM
      }
    },
    async onSendClick () {
      const wallet = useStore().state.wallet.wallet
      if (!wallet) {
        if (WalletUtils.isConnectedViaMnemonic()) {
          useStore()
            .dispatch(WalletActionTypes.LOAD_PRIVATE_KEY_AND_SIGN, {
              password: this.currentComponent.props.password
            })
            .then(() => {
              this.transferAmount()
            })
        } else {
          useStore().dispatch(WalletActionTypes.CONNECT_KEPLR)
          this.transferAmount()
        }
      } else {
        this.transferAmount()
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
      console.log('resetData')
      this.currentComponent = {
        is: ScreenState.MAIN,
        props: this.initProps()
      }
    },
    isReceiverAddressValid () {
      const receiverAddress = this.currentComponent.props.receiverAddress
      if (receiverAddress || receiverAddress.trim() !== '') {
        try {
          Bech32.decode(receiverAddress, 44)
          this.currentComponent.props.receiverErrorMsg = ''
        } catch (e) {
          console.log('address is not valid!')
          this.currentComponent.props.receiverErrorMsg =
            'address is not valid!'
        }
      } else {
        console.log('missing receiver address')
        this.currentComponent.props.receiverErrorMsg =
          'missing receiver address'
      }
    },
    isAmountFieldValid () {
      const amount = this.currentComponent.props.amount
      if (amount || amount !== '') {
        this.currentComponent.props.amountErrorMsg = ''
        const amountInUnls = CurrencyUtils.convertNolusToUNolus(amount)
        const walletBalance = String(
          this.currentComponent.props.currentBalance[0]?.balance.amount || 0
        )
        const isLowerThanOrEqualsToZero = new Dec(
          amountInUnls.amount || '0'
        ).lte(new Dec(0))
        const isGreaterThanWalletBalance = new Int(
          amountInUnls.amount.toString() || '0'
        ).gt(new Int(walletBalance))
        if (isLowerThanOrEqualsToZero) {
          this.currentComponent.props.amountErrorMsg = 'balance is too low'
          console.log('balance is too low')
        }
        if (isGreaterThanWalletBalance) {
          this.currentComponent.props.amountErrorMsg = 'balance is too big'
          console.log('balance is too big')
        }
      } else {
        this.currentComponent.props.amountErrorMsg = 'missing amount value'
      }
    },
    async transferAmount () {
      const wallet = useStore().getters.getNolusWallet
      if (wallet) {
        const coinDecimals = new Int(10).pow(new Int(6).absUInt())
        const feeAmount = new Dec('0.25').mul(new Dec(coinDecimals))
        console.log('feeAmount: ', feeAmount.truncate().toString())
        const DEFAULT_FEE = {
          amount: [
            {
              denom: 'unolus',
              amount: WalletUtils.isConnectedViaExtension()
                ? '0.25'
                : feeAmount.truncate().toString()
            }
          ],
          gas: '100000'
        }
        const txResponse = await useStore().dispatch(
          WalletActionTypes.TRANSFER_TOKENS,
          {
            receiverAddress: this.currentComponent.props.receiverAddress,
            fee: DEFAULT_FEE,
            funds: [
              {
                amount: CurrencyUtils.convertNolusToUNolus(
                  this.currentComponent.props.amount
                ).amount.toString(),
                denom: 'unolus'
              }
            ]
          }
        )
        if (txResponse) {
          console.log('txResponse: ', txResponse)
          this.currentComponent.is =
            txResponse.code === 0 ? ScreenState.SUCCESS : ScreenState.FAILED
          this.currentComponent.props.txHash = txResponse.transactionHash
        }
      }
    }
  }
})
</script>
