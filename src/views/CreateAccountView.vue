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
    ></TextFieldButtons>
    <div class="flex rounded p-4 warning-box mt-6">
      <div class="inline-block mr-2">
        <img
          src="@/assets/icons/warning.svg"
        />
      </div>
      <div class="inline-block flex-1">
        <p class="text-primary text-bold text-normal-copy">Backup your mnemonic seed securely.</p>
        <p class="text-primary text-normal-copy mt-1">Anyone with your mnemonic seed can take your assets. Lost mnemonic
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
      <button class="btn btn-primary btn-large-primary">
        Continue
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import InputField from '@/components/InputField.vue'
import TextFieldButtons from '@/components/TextFieldButtons.vue'
import { ArrowLeftIcon } from '@heroicons/vue/solid'

export default defineComponent({
  name: 'CreateAccountView',
  components: {
    ArrowLeftIcon,
    InputField,
    TextFieldButtons
  },
  data () {
    return {}
  }
})
</script>
