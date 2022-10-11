<template>
  <!-- Header -->
  <div class="flex modal-send-receive-header no-border bg-whiteGrey">
    <div class="navigation-header">
      <button class="back-arrow" type="button" @click="modelValue.onBackClick">
        <ArrowLeftIcon aria-hidden="true" class="h-5 w-5" />
      </button>
      <h1 class="nls-font-700 text-28 md:text-32 text-center text-primary">
        {{ $t('message.qr-address-title') }}
      </h1>
    </div>
  </div>

  <!-- Input Area -->
  <div class="modal-send-receive-input-area pt-0 bg-whiteGrey">
    <div class="block text-left break-words">
      <div class="flex items-center">
        <span class="text-14 text-primary nls-font-500 m-0 mr-2">
          {{ $t('message.nolus-token') }}
          </span
        >
        <div class="inline-flex items-center bg-light-grey radius-rounded text-14 text-primary nls-font-400 m-0 p-1">
          <img
            class="inline-block w-4 h-4 mr-1 my-0"
            src="@/assets/icons/coins/nls.svg"
          />
          <span>NLS</span>
        </div>
      </div>
      <div class="block mt-1">
        <p class="text-14 text-primary nls-font-700 m-0">
          {{ modelValue.walletAddress }}
        </p>
        <button
          class="btn btn-secondary btn-medium-secondary btn-icon mt-2"
          @click="modelValue.onCopyClick"
        >
          <DocumentDuplicateIcon class="icon w-4 h-4" />
          {{ $t("message.copy") }}
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

<script setup lang="ts">
import QrcodeVue from 'qrcode.vue';
import type { PropType } from 'vue';
import { ArrowLeftIcon, DocumentDuplicateIcon } from '@heroicons/vue/24/solid';

export interface ReceiveQrCodeComponentProps {
  walletAddress: string;
  onBackClick: () => void;
  onCopyClick: () => void;
}

defineProps({
  modelValue: {
    type: Object as PropType<ReceiveQrCodeComponentProps>,
    required: true,
  },
});
</script>
