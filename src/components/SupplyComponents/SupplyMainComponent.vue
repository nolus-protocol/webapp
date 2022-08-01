<template>
  <component :is="currentComponent.is" v-model="currentComponent.props" :step="step"/>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { CurrencyUtils } from '@nolus/nolusjs'
import { AssetBalance } from '@/store/modules/wallet/state'
import ConfirmComponent from '@/components/modals/templates/ConfirmComponent.vue'
import SupplyFormComponent from '@/components/SupplyComponents/SupplyFormComponent.vue'
import { useStore } from '@/store'

export interface SupplyComponentProps {
  receiverErrorMsg: string;
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  memo: string;
  receiverAddress: string;
  password: string;
  txHash: string;
  onNextClick: () => void;
  onSendClick: () => void;
  onConfirmBackClick: () => void;
  onClickOkBtn: () => void;
}

enum ScreenState {
  FORM = 'SupplyFormComponent',
  CONFIRM = 'ConfirmComponent'
}

interface SupplyMainComponentData {
  is: string;
  props: SupplyComponentProps;
}

export default defineComponent({
  name: 'SupplyComponent',
  components: {
    SupplyFormComponent,
    ConfirmComponent
  },
  props: {
    modelValue: {
      type: Object as PropType<SupplyComponentProps>
    }
  },
  data () {
    return {
      currentComponent: {} as SupplyMainComponentData,
      step: 1
    }
  },
  mounted () {
    this.currentComponent = {
      is: ScreenState.FORM,
      props: {} as SupplyComponentProps
    }
    const balances = useStore().state.wallet.balances
    console.log('balances: ', balances)
    if (balances) {
      this.currentComponent.props.currentBalance = balances
      this.currentComponent.props.selectedCurrency = balances[0]
    }

    console.log('selected value: ', this.currentComponent.props.selectedCurrency)
  },
  watch: {
    '$store.state.wallet.balances' (balances: AssetBalance[]) {
      if (balances) {
        //   this.currentComponent.props.currentBalance = balances
        //
        //   if (!this.currentComponent.props.selectedCurrency) {
        //     this.currentComponent.props.selectedCurrency = balances[0]
        //   }
      }
    }
  },
  methods: {
    formatCurrentBalance (value: AssetBalance[]) {
      if (value) {
        return CurrencyUtils.convertUNolusToNolus(
          value[0]?.balance.amount.toString()
        ).toString()
      }
    },
    onUpdateCurrency (value: AssetBalance) {
      this.$emit('update:modelValue.selectedCurrency', value)
    }
  }
})
</script>
