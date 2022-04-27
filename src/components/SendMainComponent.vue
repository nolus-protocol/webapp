<template>
  <component
    :is="currentComponent.is"
    v-model:currentComponent="currentComponent"
  />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { StarIcon } from "@heroicons/vue/solid";
import SendingConfirmComponent from "@/components/SendingConfirmComponent.vue";
import SendComponent, {
  SendComponentProps,
} from "@/components/SendComponent.vue";
import SendingSuccessComponent from "@/components/SendingSuccessComponent.vue";
import SendingFailedComponent from "@/components/SendingFailedComponent.vue";
import store, { AssetBalance } from "@/store";
import { Bech32 } from "@cosmjs/encoding";
import { Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@/utils/CurrencyUtils";
import { BaseSendType } from "./types/baseSend.type";

enum ScreenState {
  MAIN = 'SendComponent',
  CONFIRM = 'SendingConfirmComponent',
  SUCCESS = 'SendingSuccessComponent',
  FAILED = 'SendingFailedComponent'
}

export type SendMainComponentType = SendComponentProps | BaseSendType;

export type ExtractSendMainComponentType<A> = A extends {
  receiverErrorMsg: string;
  amountErrorMsg: string;
}
  ? A
  : SendComponentProps;

export interface SendMainComponentData
  extends ExtractSendMainComponentType<SendMainComponentType> {
  is: string;
  txHash: string;
}
export interface SendMainComponentProps {
  onClose: () => void;
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
    "$store.state.balances"(balances: AssetBalance[]) {
      this.currentComponent.currentBalance = balances ?? [];
    },
    "currentComponent.amount"() {
      if (this.currentComponent.amount) this.isAmountFieldValid();
      console.log("amount:", this.currentComponent.amount);
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
      if (
        this.currentComponent.amountErrorMsg === "" &&
        this.currentComponent.receiverErrorMsg === ""
      ) {
        this.currentComponent.is = ScreenState.CONFIRM;
      }
    },

    async onSendClick() {
      console.log(this.currentComponent.password);

      const txResponse = await store.dispatch("transferTokens", {
        receiverAddress: this.currentComponent.receiverAddress,
        amount: CurrencyUtils.convertNolusToUNolus(
          this.currentComponent.amount
        ).amount.toString(),
        feeAmount: "0.25",
      });
      if (txResponse) {
        console.log("txResponse: ", txResponse);
        this.currentComponent.txHash = txResponse.transactionHash;
        this.currentComponent.is =
          txResponse.code === 0 ? ScreenState.SUCCESS : ScreenState.FAILED;
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
      let {amount, memo, receiverAddress, password, is} = this.currentComponent;
      amount = "";
      memo = "";
      receiverAddress = "";
      password = "";
      is = ScreenState.MAIN;
    },
    isReceiverAddressValid() {
    let {receiverAddress, receiverErrorMsg} = this.currentComponent;
      if (
        receiverAddress ||
       receiverAddress.trim() !== ""
      ) {
        try {
          Bech32.decode(receiverAddress, 44);
          this.currentComponent.receiverErrorMsg = "";
        } catch (e) {
          console.log("address is not valid!");
          receiverErrorMsg = "address is not valid!";
        }
      } else {
        console.log("missing receiver address");
        this.currentComponent.receiverErrorMsg = "missing receiver address";
      }
    },
    isAmountFieldValid() {
      let {amount} = this.currentComponent;
      if (amount || amount !== "") {
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
        this.currentComponent.amountErrorMsg = "missing amount value";
      }
    },
  },
});
</script>
