<template>
  <div
    class="block rounded-2xl bg-white -mt-8 md:mt-auto pb-[300px] md:pb-10 pt-6 md:border border-standart shadow-box lg:w-[516px]">
    <h1 class="text-to-big-number text-primary text-center relative">
      <button class="align-baseline absolute left-0 top-2/4 -mt-3 px-4 md:px-10 z-[2]" type="button"
              v-on:click="clickBack">
        <ArrowLeftIcon aria-hidden="true" class="h-6 w-6"/>
      </button>
      <span class="inline-block align-baseline text-28 md:text-32 relative z-[2]"> Connect Ledger </span>
    </h1>

    <div class="separator-line py-6 relative z-[2]"></div>

    <div class="px-4 md:px-10">
      <p class="text-14 nls-font-400 text-primary relative z-[2]">
        Use the <span class="text-secondary">Cosmos Application</span> on your
        Ledger dongle to connect the hardware wallet.
      </p>

      <div class="relative block checkbox-container z-[2]">
        <div class="flex items-center w-full pt-6">
          <input
            id="use-bluethooth"
            name="use-bluethooth"
            type="checkbox"
            v-model="isBluetoothConnection"
          />
          <label for="use-bluethooth">Use Bluethooth</label>
        </div>
      </div>

      <div class="mt-6 hidden md:flex">
        <button class="btn btn-primary btn-large-primary" @click="connectViaLedger">
          Connect
        </button>
      </div>
    </div>
  </div>

  <div class="bg-white h-[400px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>

  <div
    class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto bg-white absolute inset-x-0 bottom-0 md:relative shadow-modal">
    <button class="btn btn-primary btn-large-primary w-80" @click="connectViaLedger">
      Connect
    </button>
  </div>
  <Modal v-if="showError" @close-modal="showError = false">
    <ErrorDialog title="Error connecting" :message="errorMessage" :try-button="clickTryAgain"/>
  </Modal>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { ArrowLeftIcon } from '@heroicons/vue/solid'

import router from '@/router'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import ErrorDialog from '@/components/modals/ErrorDialog.vue'
import Modal from '@/components/modals/templates/Modal.vue'

export default defineComponent({
  name: 'ImportLedgerView',
  components: {
    ErrorDialog,
    Modal,
    ArrowLeftIcon
  },
  data () {
    return {
      isBluetoothConnection: false,
      showError: false,
      errorMessage: ''
    }
  },
  methods: {
    clickBack: () => {
      router.go(-1)
    },
    async connectViaLedger () {
      try {
        await useStore().dispatch(WalletActionTypes.CONNECT_LEDGER, {
          isFromAuth: true,
          isBluetooth: this.isBluetoothConnection
        })
      } catch (e: any) {
        this.showError = true
        this.errorMessage = e.message
      }
    },
    async clickTryAgain () {
      this.showError = false
      this.errorMessage = ''
      await this.connectViaLedger()
    }
  }
})
</script>
