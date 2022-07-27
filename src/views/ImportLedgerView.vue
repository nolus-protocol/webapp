<template>
  <div class="block rounded-2xl bg-white mt-8 pb-10 pt-6 border border-standart shadow-box lg:w-[516px]">
    <h1 class="text-to-big-number text-primary text-center relative">
      <button
        class="inline-block align-baseline absolute left-0 top-2/4 -mt-2.5 px-10"
        type="button"
        v-on:click="clickBack"
      >
        <ArrowLeftIcon aria-hidden="true" class="h-5 w-5"/>
      </button>
      <span class="inline-block align-baseline nls-32"> Connect Ledger </span>
    </h1>

    <div class="separator-line py-6"></div>

    <div class="px-10">
      <p class="nls-14 nls-font-400 text-primary">
        Use the <span class="text-secondary">Cosmos Application</span> on your
        Ledger dongle to connect the hardware wallet.
      </p>
      <div class="flex mt-6">
        <button class="btn btn-primary btn-large-primary">
          Connect
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { ArrowLeftIcon } from '@heroicons/vue/solid'
import router from '@/router'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'

export default defineComponent({
  name: 'ImportLedgerView',
  components: {
    ArrowLeftIcon
  },
  data () {
    return {}
  },
  mounted () {
    this.connectViaLedger()
  },
  methods: {
    clickBack: () => {
      router.go(-1)
    },
    connectViaLedger: async () => {
      useStore().dispatch(WalletActionTypes.CONNECT_LEDGER)
    }
  }
})
</script>
