<template>
  <div v-cloak class="block w-screen md:w-[516px] -mt-8 md:mt-auto">
    <div class="background rounded-2xl md:border nls-border shadow-box md:filter-none">
        <h1 class="text-28 md:text-32 nls-font-700 text-primary text-center pt-6 pb-5 relative z-[2]">
        {{ $t('message.connect-wallet') }}
      </h1>
      
      <div class="separator-line z-[100]"></div>
      
      <div class="flex px-4 md:px-10 pt-10 relative z-[2] lg:pt-6">
        <button class="btn btn-box btn-large-box basis-0 grow" v-on:click="clickConnectToKeplr">
          <span class="icon icon-keplr ml-1"/>
          Keplr
        </button>

        <button class="btn btn-box btn-large-box ml-5 md:ml-4 basis-0 grow">
          <span class="icon icon-google"/>
          {{ $t('message.google') }}
        </button>
      </div>

      <div class="flex mt-6 md:mt-5 px-4 md:px-10 relative z-[2]">
        <button class="btn btn-box btn-large-box mr-5 md:mr-4 basis-0 grow" v-on:click="clickImportLedger">
          <span class="icon icon-ledger"/>
          Ledger
        </button>

        <button class="btn btn-box btn-large-box basis-0 grow" v-on:click="clickImportSeed">
          <span class="icon icon-recover"/>
          {{ $t('message.recover') }}
        </button>
      </div>

      <div class="block separator-line nls-font-400 text-12 text-center mt-10 md:mt-7 mx-4 md:mx-10 md:mb-0 relative z-[2]">
        <span class="background px-3 relative z-[2] text-primary">
          {{ $t('message.continue-with') }}
        </span>
      </div>

      <div class="background h-[420px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>

      <div class="hidden align-center justify-center pt-7 text-center mx-auto md:flex">
        <button class="btn btn-primary btn-large-primary w-80 mb-4 md:mb-10" v-on:click="clickCreateAccount">
          {{ $t('message.create-new-account') }}
        </button>
      </div>
    </div>

      <div class="md:hidden flex align-center justify-center md:pt-7 pt-4 text-center mx-auto background absolute inset-x-0 bottom-0 md:relative shadow-modal z-[100]">
        <button class="btn btn-primary btn-large-primary w-80 mb-4 lg:mb-10" v-on:click="clickCreateAccount">
          {{ $t('message.create-new-account') }}
        </button>
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
