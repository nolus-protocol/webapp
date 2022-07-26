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
      <span class="inline-block align-baseline nls-32">
        Import Mnemonic
      </span>
    </h1>

    <div class="separator-line py-6"></div>

    <div class="px-10">
      <TextField
        id="seed"
        v-model:value.trim="mnemonicSeed"
        :error-msg="errorMessage"
        :is-error="errorMessage !== ''"
        label="Mnemonic seed"
        name="seed"
      ></TextField>
    <div class="flex mt-6">
      <button class="btn btn-primary btn-large-primary mr-4 disabled" v-on:click="clickImport">
        Unlock
      </button>
    </div>
    </div>

    
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import TextField from '@/components/TextField.vue'
import { ArrowLeftIcon } from '@heroicons/vue/solid'
import router from '@/router'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { RouteNames } from '@/router/RouterNames'

export default defineComponent({
  name: 'ImportSeedView',
  components: {
    TextField,
    ArrowLeftIcon
  },
  data () {
    return {
      mnemonicSeed: '',
      errorMessage: ''
    }
  },
  methods: {
    clickBack (value: string) {
      router.go(-1)
    },
    clickImport () {
      if (this.mnemonicSeed === '') {
        this.errorMessage = 'Mnemonic seed field must be not empty!'
        return
      }
      useStore().dispatch(WalletActionTypes.CONNECT_VIA_MNEMONIC, { mnemonic: this.mnemonicSeed })
      this.mnemonicSeed = ''
      this.errorMessage = ''
      router.push({ name: RouteNames.SET_PASSWORD })
    }
  }
})
</script>
