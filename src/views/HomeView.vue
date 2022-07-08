<template>
  <div v-cloak class="block lg:w-[516px] pb-nolus-40">
    <h1 class="nls-40 nls-font-700 text-primary text-center mb-nolus-32">
      {{ $t('message.connect-wallet') }}
    </h1>
    <div
      class="bg-white rounded-2xl border border-standart shadow-box p-nolus-40"
    >
      <div class="flex bg-white">
        <button class="btn btn-box btn-large-box mr-4 basis-0 grow">
          <span class="icon icon-google"/>
          {{ $t('message.google') }}
        </button>
        <button
          class="btn btn-box btn-large-box basis-0 grow"
          v-on:click="clickImportSeed"
        >
          <span class="icon icon-recover"/>

          {{ $t('message.recover') }}
        </button>
      </div>
      <div class="flex mt-nolus-20">
        <button
          class="btn btn-box btn-large-box mr-4 basis-0 grow"
          v-on:click="clickImportLedger"
        >
          <span class="icon icon-ledger"/>
          Ledger
        </button>
        <button
          class="btn btn-box btn-large-box basis-0 grow"
          v-on:click="clickConnectToKeplr"
        >
          <span class="icon icon-keplr ml-1"/>
          Keplr
        </button>
      </div>

      <div class="block separator-line nls-font-400 nls-12 text-center mt-7">
        <span class="bg-white px-3 relative z-[2]">{{
            $t('message.continue-with')
          }}</span>
      </div>

      <div
        class="flex align-center justify-center mt-7 text-center mr-auto ml-auto"
      >
        <button
          class="btn btn-primary btn-large-primary w-80"
          v-on:click="clickCreateAccount"
        >
          {{ $t('message.create-new-account') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import router from '@/router'
import { RouteNames } from '@/router/RouterNames'

export default defineComponent({
  name: 'HomeView',
  components: {},
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
