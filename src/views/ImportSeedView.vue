<template>
  <div class="block rounded-2xl bg-white md:pb-10 pt-6 pb-[200px] -mt-8 md:mt-auto md:border border-standart shadow-box w-screen md:w-[516px]">
    <h1 class="text-to-big-number text-primary text-center relative z-[2]">
      <button class="align-baseline absolute left-0 top-2/4 -mt-3 px-4 md:px-10" type="button" v-on:click="clickBack">
        <ArrowLeftIcon aria-hidden="true" class="h-6 w-6" />
      </button>
      <span class="inline-block align-baseline text-28 md:text-32">
        {{ $t('message.import-seed') }}
      </span>
    </h1>

    <div class="separator-line py-6 relative z-[2]"></div>

    <div class="px-4 md:px-10 relative z-[2]">
      <TextField id="seed" v-model:value.trim="importStr" :error-msg="seedErrorMessage" :is-error="seedErrorMessage !== ''"
                 :label="$t('message.mnemonic-seed-or-key')" name="seed" />

      <div class="mt-6 hidden md:flex">
        <button class="btn btn-primary btn-large-primary mr-4" v-on:click="clickImport">
        {{ $t('message.import') }}
        </button>
      </div>
    </div>

    <div class="bg-white h-[400px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>

    <div class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto bg-white absolute inset-x-0 bottom-0 md:relative shadow-modal">
      <button class="btn btn-primary btn-large-primary w-80 disabled" v-on:click="clickImport">
      {{ $t('message.import') }}
      </button>
    </div>
  </div>
  <Modal v-if="showError" @close-modal="showError = false">
    <ErrorDialog title="Error connecting" :message="modalErrorMessage" :try-button="clickTryAgain"/>
  </Modal>

</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { ArrowLeftIcon } from '@heroicons/vue/solid'

import TextField from '@/components/TextField.vue'
import router from '@/router'
import { useStore } from '@/store'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { RouteNames } from '@/router/RouterNames'
import ErrorDialog from '@/components/modals/ErrorDialog.vue'
import Modal from '@/components/modals/templates/Modal.vue'

export default defineComponent({
  name: 'ImportSeedView',
  components: {
    TextField,
    ArrowLeftIcon,
    ErrorDialog,
    Modal
  },
  data () {
    return {
      showError: false,
      modalErrorMessage: '',
      importStr: '',
      seedErrorMessage: ''
    }
  },
  methods: {
    clickBack () {
      router.go(-1)
    },
    async clickImport () {
      if (this.importStr === '') {
        this.seedErrorMessage = this.$t('message.text-field-error')
        return
      }

      try {
        await useStore().dispatch(WalletActionTypes.CONNECT_VIA_MNEMONIC, { mnemonic: this.importStr })
        this.importStr = ''
        this.seedErrorMessage = ''
        await router.push({ name: RouteNames.SET_PASSWORD })
      } catch (e: any) {
        this.showError = true
        this.modalErrorMessage = e.message
      }
    },
    async clickTryAgain () {
      this.showError = false
      this.modalErrorMessage = ''
      await this.clickImport()
    }
  }
})
</script>
