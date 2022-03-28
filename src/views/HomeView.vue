<template>
  <h1 class="text-to-big-number text-primary text-center">Sign in</h1>
  <div class="block rounded-2xl bg-white mt-8 p-10 border border-standart shadow-box">
    <div class="flex">
      <button class="btn btn-box btn-large-box mr-4 basis-0 grow">
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
    <div class="flex mt-4">
      <button v-on:click="clickImportLedger" class="btn btn-box btn-large-box mr-4 basis-0 grow">
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
      <button class="btn btn-primary btn-large-primary w-80">
        Create new account
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import router from '@/router'

export default defineComponent({
  name: 'HomeView',
  components: {},
  data () {
    return {}
  },
  methods: {
    clickConnectToKeplr: () => {
      router.push({ name: 'connectingKeplr' })
    },
    clickImportLedger: () => {
      router.push({ name: 'importLedger' })
    },
    clickImportSeed: () => {
      router.push({ name: 'importSeedView' })
    }
  }
})
</script>
