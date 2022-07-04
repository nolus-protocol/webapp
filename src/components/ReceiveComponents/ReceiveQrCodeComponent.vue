<template>
  <!-- Header -->
  <div class="flex modal-send-receive-header no-border bg-whiteGrey">
    <div class="navigation-header">
      <button
        class="back-arrow"
        type="button"
        v-on:click="modelValue.onBackClick"
      >
        <ArrowLeftIcon aria-hidden="true" class="h-5 w-5"/>
      </button>
      <h1 class="nls-font-700 nls-32 text-center text-primary">
        Receive QR code
      </h1>
    </div>
  </div>

  <!-- Input Area -->
  <div class="modal-send-receive-input-area pt-0 bg-whiteGrey">
    <div class="block text-left break-words">
      <div class="flex items-center">
        <span class="nls-14 text-primary nls-font-500 m-0 mr-2"
        >Nolus token</span
        >
        <div
          class="inline-flex items-center bg-light-grey radius-rounded nls-14 nls-font-400 text-primary nls-font-400 m-0 p-1"
        >
          <img
            class="inline-block w-4 h-4 mr-1 my-0"
            src="@/assets/icons/coins/nls.svg"
          />
          <span>NLS</span>
        </div>
      </div>
      <div class="block mt-1">
        <p class="nls-14 text-primary nls-font-700 m-0">
          {{ modelValue.walletAddress }}
        </p>
        <button
          class="btn btn-secondary btn-medium-secondary btn-icon mt-2"
          v-on:click="modelValue.onCopyClick"
        >
          <DuplicateIcon class="icon w-4 h-4"/>
          Copy
        </button>
      </div>
    </div>

    <div class="flex justify-center mt-7">
      <div
        class="inline-block w-[210px] h-[210px] p-4 bg-white border border-standart radius-rounded"
      >
        <qrcode-vue
          :size="180"
          :value="modelValue.walletAddress"
          foreground="#072d63"
          render-as="svg"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { ArrowLeftIcon, DuplicateIcon } from '@heroicons/vue/solid'
import QrcodeVue from 'qrcode.vue'

export interface ReceiveQrCodeComponentProps {
  walletAddress: string;
  onBackClick: () => void;
  onCopyClick: () => void;
}

export default defineComponent({
  name: 'ReceiveQrCodeComponent',
  components: {
    ArrowLeftIcon,
    DuplicateIcon,
    QrcodeVue
  },
  props: {
    modelValue: {
      type: Object as PropType<ReceiveQrCodeComponentProps>
    }
  }
})
</script>
