<template>
  <div v-if="isCreateFormOpen">
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
                            Create account
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
      <TextFieldButtons
        name="mnemonicSeed"
        id="mnemonicSeed"
        label="Mnemonic seed"
        :value="mnemonic"
      ></TextFieldButtons>
      <div class="flex rounded p-4 warning-box mt-6">
        <div class="inline-block mr-2">
          <img
            src="@/assets/icons/warning.svg"
          />
        </div>
        <div class="inline-block flex-1">
          <p class="text-primary text-bold text-normal-copy">Backup your mnemonic seed securely.</p>
          <p class="text-primary text-normal-copy mt-1">Anyone with your mnemonic seed can take your assets. Lost
            mnemonic
            seed can’t be recovered.</p>
        </div>
      </div>
      <div class="block mt-6">
        <InputField
          type="email"
          name="email"
          id="email"
          label="Email"
        ></InputField>
      </div>
      <div class="block mt-6">
        <InputField
          type="password"
          name="password"
          id="password"
          label="Password"
        ></InputField>
      </div>
      <div class="block mt-6">
        <button v-on:click="btnContinueToConfirm" class="btn btn-primary btn-large-primary">
          Continue
        </button>
      </div>
    </div>
  </div>
  <div v-else>
    <h1 class="text-to-big-number text-primary text-center relative">

      <button
        type="button"
        class="inline-block align-baseline absolute left-0 top-2/4 -mt-2.5"
      >
        <ArrowLeftIcon v-on:click="btnBackToCreateMnemonic" class="h-5 w-5" aria-hidden="true"/>
      </button>
      <span
        class="inline-block align-baseline"
      >
                            Confirm mnemonic
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
      <SelectorTextField
        id="confirm-mnemonic"
        label="Confirm mnemonic seed"
        :is-error="confirmScreenErrorMsg !== ''"
        :error-msg="confirmScreenErrorMsgx"
        :values="mnemonicWords"
        :on-click-confirm="onClickConfirmMnemonic"
      ></SelectorTextField>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import InputField from '@/components/InputField.vue'
import TextFieldButtons from '@/components/TextFieldButtons.vue'
import { ArrowLeftIcon } from '@heroicons/vue/solid'
import SelectorTextField from '@/components/SelectorTextField.vue'
import { useStore } from '@/store'
import router from '@/router'
import { KeyUtils } from '@/utils/KeyUtils'
import { WalletActionTypes } from '@/store/modules/wallet/action-types'
import { RouteNames } from '@/router/RouterNames'

export default defineComponent({
  name: 'CreateAccountView',
  components: {
    ArrowLeftIcon,
    InputField,
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
      value.forEach(word => {
        confirmMnemonic += ' ' + word
      })

      if (this.mnemonic.trim() !== confirmMnemonic.trim()) {
        this.confirmScreenErrorMsg = 'The mnemonic phrase does not match!'
        return
      }

      useStore().dispatch(WalletActionTypes.CONNECT_VIA_MNEMONIC, { mnemonic: this.mnemonic })

      console.log('confirmMnemonic: ', confirmMnemonic)
      console.log('mnemonic: ', this.mnemonic)
      console.log('confirmMnemonic: ', this.mnemonic.trim() === confirmMnemonic.trim())
      this.mnemonic = ''
      router.push({ name: RouteNames.SET_PASSWORD })
    },
    btnContinueToConfirm () {
      this.isCreateFormOpen = false
    },
    btnBackToCreateMnemonic () {
      this.isCreateFormOpen = true
    }
  }
})
</script>
