<template>
  <component
    :is="currentComponent.is"
    v-model:currentComponent="currentComponent.props"
    :receiverErrorMsg="currentComponent.receiverErrorMsg"
    :amountErrorMsg="currentComponent.amountErrorMsg"
    :txHash="currentComponent.txHash"
  />
  {{ currentComponent }}
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { StarIcon } from "@heroicons/vue/solid";
import SendingConfirmComponent, {
  SendingConfirmComponentProps,
} from "@/components/SendingConfirmComponent.vue";
import SendComponent, {
  SendComponentProps,
} from "@/components/SendComponent.vue";
import SendingSuccessComponent, {
  SendingSuccessComponentProps,
} from "@/components/SendingSuccessComponent.vue";
import SendingFailedComponent, {
  SendingFailedComponentProps,
} from "@/components/SendingFailedComponent.vue";
import store, { AssetBalance } from "@/store";
import { Bech32 } from "@cosmjs/encoding";
import { Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@/utils/CurrencyUtils";

const ScreenState = Object.freeze({
  MAIN: "SendComponent",
  CONFIRM: "SendingConfirmComponent",
  SUCCESS: "SendingSuccessComponent",
  FAILED: "SendingFailedComponent",
});

export type SendMainComponentType =
  | SendComponentProps
  | SendComponentProps
  | SendingSuccessComponentProps
  | SendingConfirmComponentProps;
export type ExtractSendMainComponentType<A> = A extends {
  receiverErrorMsg: string;
  amountErrorMsg: string;
}
  ? A
  : SendComponentProps;
export type SendMainComponentData = {
  is: string;
  txHash: string;
  props: ExtractSendMainComponentType<SendMainComponentType>;
};

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
      props: {
        //@ts-ignore
        currentBalance: [] as AssetBalance[],
        selectedCurrency: {} as AssetBalance,
        amount: "",
        memo: "",
        receiverAddress: "",
        password: "",
        onNextClick: () => this.onNextClick,
        onSendClick: () => this.onSendClick,
        onConfirmBackClick: () => this.onConfirmBackClick,
        onClickOkBtn: () => this.onClickOkBtn,
        receiverErrorMsg: "",
        amountErrorMsg: "",
      },
    };
  },
  data() {
    return {
      currentComponent: {} as SendMainComponentData,
    };
  },
  watch: {
    "$store.state.balances"(balances: AssetBalance[]) {
      //@ts-ignore
      this.currentComponent.props.currentBalance = balances ?? [];
    },
    "currentComponent.props.amount"() {
      this.isAmountFieldValid();
      console.log("amount:", this.currentComponent.props.amount);
    },
    memo() {
      console.log("memo:", this.currentComponent.props.memo);
    },
    receiverAddress() {
      this.isReceiverAddressValid();
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
        this.currentComponent.props.amountErrorMsg === "" &&
        this.currentComponent.props.receiverErrorMsg === ""
      ) {
        this.currentComponent.is = ScreenState.CONFIRM;
      }
    },
    async onSendClick() {
      console.log(this.currentComponent.props.password);

      const txResponse = await store.dispatch("transferTokens", {
        receiverAddress: this.currentComponent.props.receiverAddress,
        amount: CurrencyUtils.convertNolusToUNolus(
          this.currentComponent.props.amount
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
      this.currentComponent.props.amount = "";
      this.currentComponent.props.memo = "";
      this.currentComponent.props.receiverAddress = "";
      this.currentComponent.props.password = "";
      this.currentComponent.is = ScreenState.MAIN;
    },
    isReceiverAddressValid() {
      if (
        this.currentComponent.props.receiverAddress ||
        this.currentComponent.props.receiverAddress.trim() !== ""
      ) {
        try {
          Bech32.decode(this.currentComponent.props.receiverAddress, 44);
          this.currentComponent.props.receiverErrorMsg = "";
        } catch (e) {
          console.log("address is not valid!");
          this.currentComponent.props.receiverErrorMsg =
            "address is not valid!";
        }
      } else {
        console.log("missing receiver address");
        this.currentComponent.props.receiverErrorMsg =
          "missing receiver address";
      }
    },
    isAmountFieldValid() {
      if (
        this.currentComponent.props.amount ||
        this.currentComponent.props.amount !== ""
      ) {
        this.currentComponent.props.amountErrorMsg = "";
        const amountInUnls = CurrencyUtils.convertNolusToUNolus(
          this.currentComponent.props.amount
        );
        const walletBalance = String(
          this.currentComponent.props.currentBalance[0]?.balance.amount || 0
        );
        const isLowerThanOrEqualsToZero = new Dec(
          amountInUnls.amount || "0"
        ).lte(new Dec(0));
        const isGreaterThanWalletBalance = new Int(
          amountInUnls.amount.toString() || "0"
        ).gt(new Int(walletBalance));
        if (isLowerThanOrEqualsToZero) {
          console.log("balance is too low");
          this.currentComponent.props.amountErrorMsg = "balance is too low";
        }
        if (isGreaterThanWalletBalance) {
          console.log("balance is too big");
          this.currentComponent.props.amountErrorMsg = "balance is too big";
        }
      } else {
        this.currentComponent.props.amountErrorMsg = "missing amount value";
      }
    },
  },
});
</script>
