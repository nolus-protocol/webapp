<template>
  <div
    class="fixed flex items-center top-0 bottom-0 left-0 right-0 justify-center background/70 z-[99]"
    @click="$emit('close-modal')"
  >
    <div
      class="text-center background w-full max-w-[552px] px-10 py-10 radius-modal mx-auto my-10 shadow-modal"
      @click.stop
    >
      <div class="flex justify-end">
        <button
          class="btn btn-secondary btn-medium-secondary btn-icon flex"
          data-v-37958d79=""
        >
          <span class="icon w-4 h-4 icon-copy" data-v-37958d79=""></span
          ><span data-v-37958d79="">Chat with me</span>
        </button>
      </div>

      <div class="flex flex-col items-center w-full">
        <CheckIcon
          class="h-14 w-14 bg-light-red/30 radius-circle p-2 text-dark-red"
        />
        <h1 class="nls-font-700 text-28 md:text-32 text-primary text-center mt-3 mb-0">
          Is your email address
        </h1>
      </div>
      <InputField
        id="email"
        label="Email"
        name="email"
        type="email"
        value=""
        @input="$emit('update:value', $event.target.value)"
      ></InputField>
      <p>That's not you? <span>Sign In with another email address</span></p>
      <div class="flex w-full">
        <div class="text-right nls-font-500 text-14">
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon flex"
            data-v-37958d79=""
          >
            <span class="icon w-4 h-4 icon-copy" data-v-37958d79=""></span
            ><span data-v-37958d79="">Back</span>
          </button>
        </div>
        <div class="text-right grow-3 nls-font-700 text-14">
          <button
            class="btn btn-secondary btn-medium-secondary btn-emphatized success w-full"
            data-v-37958d79=""
          >
            None
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { CheckIcon } from '@heroicons/vue/solid'
import InputField from '@/components/InputField.vue'
import { defineComponent } from 'vue'
import { AssetBalance } from '@/store/modules/wallet/state'

export interface SendComponentProps {
  receiverErrorMsg: string;
  amountErrorMsg: string;
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  memo: string;
  receiverAddress: string;
  password: string;
  txHash: string;
  onNextClick: () => void;
  onSendClick: () => void;
  onConfirmBackClick: () => void;
  onClickOkBtn: () => void;
}

export default defineComponent({
  name: 'ConfirmEmailModal',
  components: {
    CheckIcon,
    InputField
  },
  props: {}
})
</script>
