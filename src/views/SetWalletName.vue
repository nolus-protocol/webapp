<template>
  <div class="page-container import-ledger">
    <LogoLink href="#"></LogoLink>
    <div class="container mx-auto">
      <div class="grid grid-cols-12 gap-6 pt-24">
        <div class="col-start-4 col-span-5">
          <h1 class="text-to-big-number text-primary text-center relative">
            <button
              class="inline-block align-baseline absolute left-0 top-2/4 -mt-2.5"
              type="button"
            >
              <ArrowLeftIcon aria-hidden="true" class="h-5 w-5"/>
            </button>
            <span
              class="inline-block align-baseline"
            >
                            Set wallet name
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
            <InputField
              id="wallet-name"
              label="Wallet name"
              name="wallet-name"
              type="text"
            ></InputField>
            <div class="block mt-6">
              <button class="btn btn-primary btn-large-primary">
                Continue
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
import InputField from '@/components/InputField.vue'
import { ArrowLeftIcon } from '@heroicons/vue/solid'

export default defineComponent({
  name: 'SetWalletName',
  components: {
    LogoLink,
    ArrowLeftIcon,
    InputField
  },
  data () {
    return {}
  }
})
</script>
