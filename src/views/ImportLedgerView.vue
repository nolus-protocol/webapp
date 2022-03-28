<template>
  <h1 class="text-to-big-number text-primary text-center relative">
    <button
      v-on:click="clickBack"
      type="button"
      class="inline-block align-baseline absolute left-0 top-2/4 -mt-2.5"
    >
      <ArrowLeftIcon class="h-5 w-5" aria-hidden="true"/>
    </button>
    <span
      class="inline-block align-baseline"
    >
                            Import Ledger
                        </span>
  </h1>

  <div
    class="
                        block
                        rounded-2xl
                        bg-white
                        mt-8
                        p-10
                        border border-standart
                        shadow-box
                        "
  >
    <p
      class="text-normal-copy text-primary"
    >
      Use the <span class="text-secondary">Cosmos Application</span> on your Ledger dongle to connect the hardware
      wallet.
    </p>
    <div class="flex mt-6">
      <button class="btn btn-primary btn-large-primary mr-4 js-loading">
        Connect Ledger
      </button>

      <button class="btn btn-secondary btn-large-secondary invisible">
        Cancel
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { ArrowLeftIcon } from '@heroicons/vue/solid'
import router from '@/router'
import store from '@/store'

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
      store.dispatch('connectToLedger')
    }
  }
})
</script>
