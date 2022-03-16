<template>
    <div class="page-container import-ledger">
        <LogoLink href="#"></LogoLink>
        <div class="container mx-auto">
            <div class="grid grid-cols-12 gap-6 pt-24">
                <div class="col-start-4 col-span-5">
                    <h1 class="text-to-big-number text-primary text-center relative">
                        <button
                            type="button"
                            class="inline-block align-baseline absolute left-0 top-2/4 -mt-2.5"
                        >
                            <ArrowLeftIcon class="h-5 w-5" aria-hidden="true" />
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
                            Use the <span class="text-secondary">Cosmos Application</span> on your Ledger dongle to connect the hardware wallet.
                        </p>
                        <div class="mt-6">
                            <button class="btn btn-primary btn-large-primary">
                                Connect Ledger
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import LogoLink from '@/components/LogoLink.vue'
import { ArrowLeftIcon } from '@heroicons/vue/solid'

export default defineComponent({
  name: 'ImportLedgerView',
  components: {
    LogoLink,
    ArrowLeftIcon
  },
  data () {
    return {}
  }
})
</script>
