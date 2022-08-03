<template>
  <h1 class="text-to-big-number text-primary text-center relative">
    <button class="inline-block align-baseline absolute left-0 top-2/4 -mt-3" type="button">
      <ArrowLeftIcon aria-hidden="true" class="h-6 w-6"/>
    </button>
    <span class="inline-block align-baseline">
      Set password
    </span>
  </h1>

  <div class="block rounded-2xl bg-white mt-8 p-10 border border-standart shadow-box">
    <InputField
      id="password"
      v-model:value.trim="password"
      :error-msg="errorMessage"
      :is-error="errorMessage !== ''"
      label="Password"
      name="password"
      type="password"
    ></InputField>
    <div class="block mt-6">
      <button class="btn btn-primary btn-large-primary" v-on:click="clickContinue">
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
