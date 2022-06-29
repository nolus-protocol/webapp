<template>
  <div class="block w-[516px] pb-nolus-40">
    <h1 class="nls-40 nls-font-700 text-primary text-center mb-nolus-32">
      Connect Wallet
    </h1>
    <div
      class="bg-white rounded-2xl border border-standart shadow-box p-nolus-40"
    >
      <div class="flex bg-white">
        <button class="btn btn-box btn-large-box mr-4 basis-0 grow">
          <span class="icon icon-google" />
          Sign In With Google
        </button>
        <button
          v-on:click="clickImportSeed"
          class="btn btn-box btn-large-box basis-0 grow"
        >
          <span class="icon icon-recover" />

          Recover
        </button>
      </div>
      <div class="flex mt-nolus-20">
        <button
          v-on:click="clickImportLedger"
          class="btn btn-box btn-large-box mr-4 basis-0 grow"
        >
          <span class="icon icon-ledger" />
          Ledger
        </button>
        <button
          v-on:click="clickConnectToKeplr"
          class="btn btn-box btn-large-box basis-0 grow"
        >
          <span class="icon icon-keplr ml-1" />
          Keplr
        </button>
      </div>

      <div class="block separator-line nls-font-400 nls-12 text-center mt-7">
        <span class="bg-white px-3 relative z-[2]">Or continue with</span>
      </div>

      <div
        class="flex align-center justify-center mt-7 text-center mr-auto ml-auto"
      >
        <button
          class="btn btn-primary btn-large-primary w-80"
          v-on:click="clickCreateAccount"
        >
          Create new account
        </button>
      </div>
    </div>

    <!--    <WithdrawSupplyModal :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/>-->
    <!--    <SupplyWithdrawModal :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/>-->
    <!-- <LeaseModal :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/> -->
    <!--    <BuySwapModal :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/>-->
    <!-- <SwapBuyModal :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/> -->
    <!-- <ReceiveQrCodeModal :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/> -->
    <!--    <ReceiveSendModal :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/>-->
    <!-- <ConfirmSendingModalError :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/> -->
    <!-- <ConfirmSendingModalSuccess :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/> -->
    <!-- <ConfirmSendingModalInput :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/> -->
    <!-- <ConfirmSendingModal :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/> -->
    <!--    <SendReceiveModal :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/>-->
    <!-- <ErrorModal :try-button="tryButton" v-show="showModal" @close-modal="showModal = false"/> -->
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import router from "@/router";
import { RouteNames } from "@/router/RouterNames";

export default defineComponent({
  name: "HomeView",
  components: {
    // ErrorModal,
    // ReceiveSendModal
    // SwapBuyModal,
    // BuySwapModal,
    // LeaseModal,
    // SupplyWithdrawModal,
    // WithdrawSupplyModal
  },
  data() {
    return {
      showModal: true,
    };
  },
  methods: {
    clickConnectToKeplr: () => {
      router.push({ name: RouteNames.CONNECT_KEPLR });
    },
    clickImportLedger: () => {
      router.push({ name: RouteNames.IMPORT_LEDGER });
    },
    clickImportSeed: () => {
      router.push({ name: RouteNames.IMPORT_SEED });
    },
    tryButton: () => {
      console.log("btn try again");
    },
    clickCreateAccount: () => {
      router.push({ name: RouteNames.CREATE_ACCOUNT });
    },
  },
});
</script>
