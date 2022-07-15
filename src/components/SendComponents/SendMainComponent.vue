<template>
  <component :is="currentComponent.is" v-model="currentComponent.props"/>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { StarIcon } from '@heroicons/vue/solid'
import { Dec, Int } from '@keplr-wallet/unit'
import { CurrencyUtils } from '@nolus/nolusjs'
import { Bech32 } from '@cosmjs/encoding'

import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue'
import SendComponent, { SendComponentProps } from '@/components/SendComponents/SendComponent.vue'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { AssetBalance } from '@/store/modules/wallet/state'
import { WalletUtils } from '@/utils/WalletUtils'
import { assetsInfo } from '@/config/assetsInfo'

enum ScreenState {
  MAIN = 'SendComponent',
<<<<<<< HEAD
  CONFIRM = 'ConfirmComponent',
=======
  CONFIRM = 'ConfirmComponent'
>>>>>>> 37830a3 (supply witdraw optimization)
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
    ConfirmComponent
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
      this.currentComponent.props.selectedCurrency = balances[0]
    }
  },
  data () {
    return {
      currentComponent: {} as SendMainComponentData,
      step: 1
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
    'currentComponent.props.memo' () {
      // console.log('memo:', this.currentComponent.props.memo)
    },
    'currentComponent.props.receiverAddress' () {
      if (this.currentComponent.props.receiverAddress) {
        this.isReceiverAddressValid()
      }
    },
    'currentComponent.props.amount' () {
      if (this.currentComponent.props.amount) {
        this.isAmountFieldValid()
      }
    }
  },
  emits: ['defaultState'],
  methods: {
    initProps () {
      return {
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
    },
    onNextClick () {
      this.step = 3
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
      if (!amount) {
        this.currentComponent.props.amountErrorMsg = 'missing amount value'
      }

      this.currentComponent.props.amountErrorMsg = ''
      const selectedCurrency = this.currentComponent.props.selectedCurrency
      const {
        coinMinimalDenom,
        coinDecimals
      } = assetsInfo[selectedCurrency.balance.denom]
      const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(amount, coinMinimalDenom, coinDecimals)
      const walletBalance = String(
        selectedCurrency?.balance.amount || 0
      )
      const isLowerThanOrEqualsToZero = new Dec(
        minimalDenom.amount || '0'
      ).lte(new Dec(0))
      const isGreaterThanWalletBalance = new Int(
        minimalDenom.amount.toString() || '0'
      ).gt(new Int(walletBalance))

      if (isLowerThanOrEqualsToZero) {
        this.currentComponent.props.amountErrorMsg = 'balance is too low'
        console.log('balance is too low')
      }
      if (isGreaterThanWalletBalance) {
        this.currentComponent.props.amountErrorMsg = 'balance is too big'
        console.log('balance is too big')
      }
    },
    async transferAmount () {
      const wallet = useStore().getters.getNolusWallet
      if (wallet) {
        const feeDecimals = new Int(10).pow(new Int(6).absUInt())
        const feeAmount = new Dec('0.25').mul(new Dec(feeDecimals))
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

        const selectedCurrency = this.currentComponent.props.selectedCurrency
        const {
          coinMinimalDenom,
          coinDecimals
        } = assetsInfo[selectedCurrency.balance.denom]
        const minimalDenom = CurrencyUtils.convertDenomToMinimalDenom(this.currentComponent.props.amount, coinMinimalDenom, coinDecimals)
        const txResponse = await useStore().dispatch(
          WalletActionTypes.TRANSFER_TOKENS,
          {
            receiverAddress: this.currentComponent.props.receiverAddress,
            fee: DEFAULT_FEE,
            funds: [
              {
                amount: minimalDenom.amount.toString(),
                denom: selectedCurrency.balance.denom
              }
            ]
          }
        )
        if (txResponse) {
          txResponse.code === 0 ? this.step = 3 : this.step = 4
          this.currentComponent.props.txHash = txResponse.transactionHash
        }
      }
    }
  }
})
</script>
