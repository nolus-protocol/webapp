<template>
  <h1 class="text-to-big-number text-primary text-center">Sign in</h1>
  <div class="block rounded-2xl bg-white mt-8 p-10 border border-standart shadow-box">
    <div class="flex">
      <button class="btn btn-box btn-large-box mr-4 basis-0 grow" disabled>
        <img
          src="@/assets/icons/google.svg"
        />
        Sign In With Google
      </button>
      <button v-on:click="clickImportSeed" class="btn btn-box btn-large-box basis-0 grow">
        <img
          src="@/assets/icons/move-down.svg"
        />
        Import existing account
      </button>
    </div>
    <div class="flex mt-4" aria-disabled="true">
      <button v-on:click="clickImportLedger" class="btn btn-box btn-large-box mr-4 basis-0 grow" disabled>
        <img
          src="@/assets/icons/clock.svg"
        />
        Import Ledger
      </button>
      <button v-on:click="clickConnectToKeplr" class="btn btn-box btn-large-box basis-0 grow">
        <img
          src="@/assets/icons/keplr.svg"
        />
        Connect Keplr
      </button>
    </div>

    <div class="block separator-line text-detail text-primary text-center mt-7">
      <span class="bg-white px-3 relative z-[2]">Or continue with</span>
    </div>

    <div class="block mt-7 text-center">
      <button class="btn btn-primary btn-large-primary w-80" v-on:click="clickCreateAccount">
        Create new account
      </button>
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
import { defineComponent } from 'vue'
import router from '@/router'
import { RouteNames } from '@/router/RouterNames'

export default defineComponent({
  name: 'HomeView',
  components: {
    // ErrorModal,
    // ReceiveSendModal
    // SwapBuyModal,
    // BuySwapModal,
    // LeaseModal,
    // SupplyWithdrawModal,
    // WithdrawSupplyModal
  },
  data () {
    return {
      showModal: true
    }
  },
  methods: {
    clickConnectToKeplr: () => {
      router.push({ name: RouteNames.CONNECT_KEPLR })
    },
    clickImportLedger: () => {
      router.push({ name: RouteNames.IMPORT_LEDGER })
    },
    clickImportSeed: () => {
      router.push({ name: RouteNames.IMPORT_SEED })
    },
    tryButton: () => {
      console.log('btn try again')
    },
    clickCreateAccount: () => {
      router.push({ name: RouteNames.CREATE_ACCOUNT })
    }
  }
})
</script>
