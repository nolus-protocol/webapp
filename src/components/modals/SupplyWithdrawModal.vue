<template>
  <div
    class="fixed flex items-end modal md:items-center top-0 bottom-0 left-0 right-0 justify-center bg-white/70 backdrop-blur-xl z-[99] modal-send-receive-parent"
    @click="$emit('close-modal')"
  >
    <button class="btn-close-modal" @click="$emit('close-modal')">
      <img src="@/assets/icons/cross.svg" class="inline-block w-4 h-4" />
    </button>

    <div
      class="text-center bg-white w-full max-w-[516px] radius-modal mx-auto shadow-modal modal-send-receive"
      @click.stop
    >
      <!-- Header -->
      <div class="flex modal-send-receive-header">
        <button
          :class="isSendActive ? 'active' : ''"
          v-on:click="switchTab(true)"
        >
          Supply
        </button>
        <button
          :class="!isSendActive ? 'active' : ''"
          v-on:click="switchTab(false)"
        >
          Withdraw
        </button>
      </div>
      <component
        :is="this.currentComponent.is"
        v-model="this.currentComponent.props"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import SupplyComponent from "@/components/modals/SupplyComponent.vue";
import WithdrawComponent from "@/components/modals/WithdrawComponent.vue";
import { AssetBalance } from "@/store/modules/wallet/state";
enum ScreenState {
  SUPPLY = "SupplyComponent",
  WITHDRAW = "WithdrawComponent",
}
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
interface SupplyWidthdrawModalData {
  is: string;
  props: object | SupplyComponentProps;
}

export default defineComponent({
  name: "SupplyWithdrawModal",
  components: {
    SupplyComponent,
    WithdrawComponent,
  },
  data() {
    return {
      currentComponent: {} as SupplyWidthdrawModalData,
      isSendActive: true,
    };
  },
  mounted() {
    this.currentComponent = {
      is: ScreenState.SUPPLY,
      props: {
        onClose: () => this.onCloseModal(),
      },
    };
  },
  methods: {
    switchTab(value: boolean) {
      if (value) {
        this.currentComponent = {
          is: ScreenState.SUPPLY,
          props: {
            onClose: () => this.onCloseModal(),
          },
        };
      } else {
        this.currentComponent = {
          is: ScreenState.WITHDRAW,
          props: {
            onClose: () => this.onCloseModal(),
          },
        };
      }

      this.isSendActive = value;
    },
    onCloseModal() {
      this.$emit("close-modal");
    },
  },
});
</script>
