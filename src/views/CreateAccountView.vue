<template>
  <div v-if="isCreateFormOpen" class="">
    <h1 class="text-to-big-number text-primary text-center relative">
      <button
        class="inline-block align-baseline absolute left-0 top-2/4 -mt-2.5"
        type="button"
        v-on:click="clickBack"
      >
        <ArrowLeftIcon aria-hidden="true" class="h-5 w-5"/>
      </button>
      <span class="inline-block align-baseline"> Create account </span>
    </h1>
    <div
      class="block rounded-2xl bg-white mt-8 p-10 border border-standart shadow-box md:max-w-[516px]"
    >
      <!--   <TextFieldButtons
        name="mnemonicSeed"
        id="mnemonicSeed"
        label="Mnemonic seed"
        :value="mnemonic"
        :on-click-copy="onClickCopy"
        :on-click-print="onClickPrint"
      ></TextFieldButtons> -->

      <TextFieldButtons
        id="mnemonicSeed"
        :on-click-copy="onClickCopy"
        :on-click-print="onClickPrint"
        :value="mnemonic"
        label="Mnemonic seed"
        name="mnemonicSeed"
      ></TextFieldButtons>
      <div class="flex rounded p-4 warning-box mt-6">
        <div class="inline-block mr-2">
          <img src="@/assets/icons/warning.svg"/>
        </div>
        <div class="inline-block flex-1">
          <p class="text-primary nls-font-700 nls-14 nls-font-400">
            Backup your mnemonic seed securely.
          </p>
          <p class="text-primary nls-14 nls-font-400 mt-1">
            Anyone with your mnemonic seed can take your assets. Lost mnemonic
            seed can’t be recovered.
          </p>
        </div>
      </div>
      <!--      <div class="block mt-6">-->
      <!--        <InputField-->
      <!--          type="email"-->
      <!--          name="email"-->
      <!--          id="email"-->
      <!--          label="Email"-->
      <!--        ></InputField>-->
      <!--      </div>-->
      <!--      <div class="block mt-6">-->
      <!--        <InputField-->
      <!--          type="password"-->
      <!--          name="password"-->
      <!--          id="password"-->
      <!--          label="Password"-->
      <!--        ></InputField>-->
      <!--      </div>-->

      <div class="block mt-6 w-full">
        <DynamicForm :formValue="formDataCredentialsModel"/>
      </div>

      <div class="block mt-6 sm:color-white">
        <button
          class="btn btn-primary btn-large-primary sm:w-full"
          v-on:click="btnContinueToConfirm"
        >
          Continue
        </button>
      </div>
    </div>
  </div>
  <div v-else class="md:max-w-[516px]">
    <h1
      class="text-to-big-number text-primary text-center relative md:max-w-[516px]"
    >
      <button
        class="inline-block align-baseline absolute left-0 top-2/4 -mt-2.5"
        type="button"
      >
        <ArrowLeftIcon
          aria-hidden="true"
          class="h-5 w-5"
          v-on:click="btnBackToCreateMnemonic"
        />
      </button>
      <span class="inline-block align-baseline"> Confirm mnemonic </span>
    </h1>

    <div
      class="block rounded-2xl bg-white mt-8 p-10 border border-standart shadow-box"
    >
      <SelectorTextField
        id="confirm-mnemonic"
        :error-msg="confirmScreenErrorMsgx"
        :is-error="confirmScreenErrorMsg !== ''"
        :on-click-confirm="onClickConfirmMnemonic"
        :values="mnemonicWords"
        label="Confirm mnemonic seed"
      ></SelectorTextField>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import TextFieldButtons from '@/components/TextFieldButtons.vue'
import { ArrowLeftIcon } from '@heroicons/vue/solid'
import SelectorTextField from '@/components/SelectorTextField.vue'
import { useStore } from '@/store'
import router from '@/router'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { RouteNames } from '@/router/RouterNames'
import { StringUtils } from '@/utils/StringUtils'
import { KeyUtils } from '@nolus/nolusjs'

export default defineComponent({
  name: 'CreateAccountView',
  components: {
    ArrowLeftIcon,
    TextFieldButtons,
    SelectorTextField
  },
  data () {
    return {
      isCreateFormOpen: true,
      mnemonic: '',
      mnemonicWords: [] as string[],
      confirmScreenErrorMsg: ''
    }
  },
  mounted () {
    this.mnemonic = KeyUtils.generateMnemonic()
    const words = this.mnemonic.split(' ')
    for (let i = 0; i < words.length; i++) {
      words[i] = words[i].trim()
    }
    words.sort((word1, word2) => {
      return word1 > word2 ? 1 : -1
    })
    this.mnemonicWords = words
  },
  methods: {
    onClickConfirmMnemonic (value: []) {
      let confirmMnemonic = ''
      value.forEach((word) => {
        confirmMnemonic += ' ' + word
      })

      if (this.mnemonic.trim() !== confirmMnemonic.trim()) {
        this.confirmScreenErrorMsg = 'The mnemonic phrase does not match!'
        return
      }

      useStore().dispatch(WalletActionTypes.CONNECT_VIA_MNEMONIC, {
        mnemonic: this.mnemonic
      })
      this.mnemonic = ''
      router.push({ name: RouteNames.SET_PASSWORD })
    },
    btnContinueToConfirm () {
      this.isCreateFormOpen = false
    },
    btnBackToCreateMnemonic () {
      this.isCreateFormOpen = true
    },
    onClickCopy () {
      StringUtils.copyToClipboard(this.mnemonic)
    },
    onClickPrint () {
      const printWindow = window.open()
      printWindow?.document.open('text/plain')
      printWindow?.document.write(this.mnemonic)
      printWindow?.document.close()
      printWindow?.focus()
      printWindow?.print()
      printWindow?.close()
    },
    clickBack: () => {
      router.go(-1)
    }
  }
})
</script>
