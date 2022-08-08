<template>
  <div class="block rounded-2xl bg-white md:pb-10 pt-6 pb-[300px] -mt-8 md:mt-auto md:border border-standart shadow-box w-screen md:w-[516px]">
    <h1 class="text-to-big-number text-primary text-center relative">
      <button class="align-baseline absolute left-0 top-2/4 -mt-3 px-4 md:px-10" type="button" v-on:click="clickBack">
        <ArrowLeftIcon aria-hidden="true" class="h-6 w-6" />
      </button>
      <span class="inline-block align-baseline text-28 md:text-32">
        Set password
      </span>
    </h1>

    <div class="separator-line py-6 relative z-[2]"></div>

    <InputField
      class="px-4 md:px-10"
      id="password"
      v-model:value.trim="password"
      :error-msg="errorMessage"
      :is-error="errorMessage !== ''"
      label="Password"
      name="password"
      type="password"
    ></InputField>

    <div class="mt-6 px-4 md:px-10 hidden md:flex">
      <button class="btn btn-primary btn-large-primary disabled" v-on:click="clickContinue">
        Continue
      </button>
    </div>

    <div class="bg-white h-[400px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>

    <div class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto bg-white absolute inset-x-0 bottom-0 md:relative shadow-modal">
      <button class="btn btn-primary btn-large-primary w-80 disabled" v-on:click="clickContinue">
        Continue
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import InputField from '@/components/InputField.vue'
import { ArrowLeftIcon } from '@heroicons/vue/solid'
import { useStore } from '@/store'
import router from '@/router'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { RouteNames } from '@/router/RouterNames'

export default defineComponent({
  name: 'SetPassword',
  components: {
    ArrowLeftIcon,
    InputField
  },
  data () {
    return {
      password: '',
      errorMessage: ''
    }
  },
  methods: {
    clickContinue () {
      if (this.password === '') {
        this.errorMessage = 'Please set password.'
        return
      }
      useStore().dispatch(WalletActionTypes.STORE_PRIVATE_KEY, { password: this.password })
      router.push({ name: RouteNames.DASHBOARD })
      this.errorMessage = ''
    }
  }
})
</script>
