<template>
  <h1 class="text-to-big-number text-primary text-center relative">
    <button
      type="button"
      class="inline-block align-baseline absolute left-0 top-2/4 -mt-2.5"
    >
      <ArrowLeftIcon class="h-5 w-5" aria-hidden="true"/>
    </button>
    <span
      class="inline-block align-baseline"
    >
                            Set password
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
      type="password"
      name="password"
      id="password"
      label="Password"
      v-model:value.trim="password"
      :error-msg="errorMessage"
      :is-error="errorMessage !== ''"
    ></InputField>
    <div class="block mt-6">
      <button v-on:click="clickContinue" class="btn btn-primary btn-large-primary">
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
