<template>
  <div v-if="isCreateFormOpen">
  <button class="grid w-screen place-items-center md:hidden -mt-8 md:mt-auto" type="button" v-on:click="clickBack">
    <ArrowLeftIcon aria-hidden="true" class="h-7 w-7" />
  </button>
  <div class="block rounded-2xl bg-white mt-5 md:mt-8 pb-10 pt-6 border border-standart shadow-box md:max-w-[516px]">
    <h1 class="text-to-big-number text-primary nls-32 text-center relative">
      <button class="align-baseline absolute left-0 top-2/4 -mt-2.5 px-6 md:px-10 hidden md:inline-block" type="button" v-on:click="clickBack">
        <ArrowLeftIcon aria-hidden="true" class="h-5 w-5" />
      </button>
      <span class="inline-block align-baseline relative z-[2]"> Create wallet </span>
    </h1>

    <div class="separator-line p-6 relative z-[2]"></div>

    <div class="px-4 md:px-10">
      <TextFieldButtons
        class="relative z-[2]"
        name="mnemonicSeed"
        id="mnemonicSeed"
        label="Mnemonic seed"
        :value="mnemonic"
        :on-click-copy="onClickCopy"
        :on-click-print="onClickPrint">
      </TextFieldButtons>

      <div class="flex rounded p-4 warning-box mt-6 relative z-[2]">
        <div class="inline-block mr-2">
          <img src="@/assets/icons/warning.svg"/>
        </div>
        <div class="inline-block flex-1">
          <p class="text-primary nls-font-700 nls-14">
            Backup your mnemonic seed securely. <span class="text-primary nls-14 nls-font-400">
            Never share it with others or enter it in unverified sites.</span>
          </p>
        </div>
      </div>

      <div class="block mt-6 sm:color-white">
        <button class="btn btn-primary btn-large-primary" v-on:click="btnContinueToConfirm">
          Continue
        </button>
      </div>

        <div class="bg-white h-[420px] absolute inset-x-0 bottom-0 z-[0] md:hidden"></div>

        <div class="md:hidden flex align-center justify-center md:pt-7 p-4 text-center mx-auto bg-white absolute inset-x-0 bottom-0 md:relative shadow-modal">
          <button class="btn btn-primary btn-large-primary w-80" v-on:click="btnContinueToConfirm">
            Continue
          </button>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="md:max-w-[516px]">
    <button class="grid w-screen place-items-center md:hidden -mt-8 md:mt-auto" type="button" v-on:click="clickBack">
      <ArrowLeftIcon aria-hidden="true" class="h-7 w-7" />
    </button>
    <div class="block rounded-2xl bg-white mt-5 md:mt-8 pb-10 pt-6 border border-standart shadow-box">
      <h1 class="text-to-big-number text-primary nls-32 text-center relative md:max-w-[516px]">
        <button class="align-baseline absolute left-0 top-2/4 -mt-2.5 px-6 md:px-10 hidden md:inline-block" type="button" v-on:click="clickBack">
          <ArrowLeftIcon aria-hidden="true" class="h-5 w-5" />
        </button>
        <span class="inline-block align-baseline"> Confirm mnemonic </span>
      </h1>

      <div class="separator-line p-6"></div>

      <SelectorTextField class="px-4 md:px-10"
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
