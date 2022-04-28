<template>
  <component
    :is="currentComponent.is"
    v-model:currentComponent="currentComponent"
  />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { StarIcon } from "@heroicons/vue/solid";
import SendingConfirmComponent, { SendConfirmComponentProps } from "@/components/SendingConfirmComponent.vue";
import SendComponent, {
  SendComponentProps,
} from "@/components/SendComponent.vue";
import SendingSuccessComponent from "@/components/SendingSuccessComponent.vue";
import SendingFailedComponent, { SendFailedComponentProps } from "@/components/SendingFailedComponent.vue";
import { Bech32 } from "@cosmjs/encoding";
import { Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@/utils/CurrencyUtils";
import { useStore } from '@/store'
import { WalletActionTypes } from "@/store/modules/wallet/action-types";
import { AssetBalance } from "@/store/modules/wallet/state";

enum ScreenState {
  MAIN = 'SendComponent',
  CONFIRM = 'SendingConfirmComponent',
  SUCCESS = 'SendingSuccessComponent',
  FAILED = 'SendingFailedComponent'
}

const isSendComponentProps = (x: unknown): x is SendComponentProps =>{
  return typeof x === "object" && x !== null && x.hasOwnProperty("receiverErrorMsg") && x.hasOwnProperty("amountErrorMsg")
}
type ExtractSendМainComponentData = SendComponentProps | SendConfirmComponentProps | SendFailedComponentProps | SendFailedComponentProps;

type SendMainComponentData  = ExtractSendМainComponentData & {
  is: string,
  txHash: string,
}
export interface SendMainComponentProps {
  onClose: () => void
}

export default defineComponent({
  name: "SendMainComponent",
  components: {
    StarIcon,
    SendComponent,
    SendingConfirmComponent,
    SendingSuccessComponent,
    SendingFailedComponent,
  },
  props: {
    modelValue: {
      type: Object,
    },
  },
  mounted() {
    this.currentComponent = {
      is: ScreenState.MAIN,
      txHash: "",
      currentBalance: [] as AssetBalance[],
      selectedCurrency: {} as AssetBalance,
      amount: "",
      memo: "",
      receiverAddress: "",
      password: "",
      onNextClick: () => this.onNextClick(),
      onSendClick: () => this.onSendClick(),
      onConfirmBackClick: () => this.onConfirmBackClick(),
      onClickOkBtn: () => this.onClickOkBtn(),
      receiverErrorMsg: "",
      amountErrorMsg: "",
    };
  },
  data() {
   
    return {
      currentComponent: {} as SendMainComponentData,
    };
  },
  watch: {
    '$store.state.wallet.balances' (balances: AssetBalance[]) {
      if (balances) {
        this.currentComponent.currentBalance = balances
      }
    },
    "currentComponent.memo"() {
      console.log("memo:", this.currentComponent.memo);
    },
    "currentComponent.receiverAddress"() {
      if (this.currentComponent.receiverAddress) this.isReceiverAddressValid();
    },
  },
  methods: {
    reset() {
      console.log("here");
      Object.assign(this.$data, this.$options.data);
    },
    onNextClick() {
      this.isAmountFieldValid();
      this.isReceiverAddressValid();
      if (isSendComponentProps(this.currentComponent) && this.currentComponent.amountErrorMsg === '' && this.currentComponent.receiverErrorMsg === '') {
        this.currentComponent.is = ScreenState.CONFIRM
      }
    },

    async onSendClick () {
      console.log(this.currentComponent.password)

      const txResponse = await useStore().dispatch(WalletActionTypes.TRANSFER_TOKENS, {
        receiverAddress: this.currentComponent.receiverAddress,
        amount: CurrencyUtils.convertNolusToUNolus(this.currentComponent.amount).amount.toString(),
        feeAmount: '0.25'
      })
      if (txResponse) {
        console.log('txResponse: ', txResponse)
        this.currentComponent.txHash = txResponse.transactionHash
        this.currentComponent.is = txResponse.code === 0 ? ScreenState.SUCCESS : ScreenState.FAILED
      }
    },

    onConfirmBackClick() {
      this.currentComponent.is = ScreenState.MAIN;
    },
    onClickOkBtn() {
      this.resetData();
      this.modelValue?.onClose();
    },
    resetData() {
      this.currentComponent.amount = "";
      this.currentComponent.memo = "";
      this.currentComponent.receiverAddress = "";
      this.currentComponent.password = "";
      this.currentComponent.is = ScreenState.MAIN;
    },
    isReceiverAddressValid() {
      if (isSendComponentProps(this.currentComponent)) {
        
      } ;
    let {receiverAddress} = this.currentComponent;
      if (
        isSendComponentProps(this.currentComponent) &&
        (receiverAddress || receiverAddress.trim() !== "")
      ) {
        try {
          Bech32.decode(receiverAddress, 44);
          this.currentComponent.receiverErrorMsg = "";
        } catch (e) {
          console.log("address is not valid!");
          this.currentComponent.receiverErrorMsg = "address is not valid!";
        }
      } else {
        console.log("missing receiver address");
        if (isSendComponentProps(this.currentComponent)) this.currentComponent.receiverErrorMsg = "missing receiver address";
      }
    },
    isAmountFieldValid() {
      let {amount} = this.currentComponent;
      if ((amount || amount !== "") && isSendComponentProps(this.currentComponent)) {
        this.currentComponent.amountErrorMsg = "";
        const amountInUnls = CurrencyUtils.convertNolusToUNolus(
         amount
        );
        const walletBalance = String(
          this.currentComponent.currentBalance[0]?.balance.amount || 0
        );
        const isLowerThanOrEqualsToZero = new Dec(
          amountInUnls.amount || "0"
        ).lte(new Dec(0));
        const isGreaterThanWalletBalance = new Int(
          amountInUnls.amount.toString() || "0"
        ).gt(new Int(walletBalance));
        if (isLowerThanOrEqualsToZero) {
          console.log("balance is too low");
          this.currentComponent.amountErrorMsg = "balance is too low";
        }
        if (isGreaterThanWalletBalance) {
          console.log("balance is too big");
          this.currentComponent.amountErrorMsg = "balance is too big";
        }
      } else {
        if(isSendComponentProps(this.currentComponent)) this.currentComponent.amountErrorMsg = "missing amount value";
      }
    },
  },
});
</script>
