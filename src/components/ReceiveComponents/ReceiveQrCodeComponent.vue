<template>
  <!-- Header -->
  <div class="flex modal-send-receive-header no-border backgroundGrey">
    <div class="navigation-header border-b border-standart">
      <button 
        class="back-arrow" 
        type="button" 
        @click="modelValue.onBackClick"
      >
        <ArrowLeftIcon aria-hidden="true" class="h-5 w-5" />
      </button>
      <h1 class="nls-font-700 text-28 md:text-32 text-center dark-text">
        {{ $t('message.qr-address-title') }}
      </h1>
    </div>
  </div>

  <!-- Input Area -->
  <div class="modal-send-receive-input-area pt-1 backgroundGrey">
    <div class="block text-left break-words">
      <div class="flex items-center">
        <span class="text-14 text-primary nls-font-500 m-0 mr-2">
          {{ $t('message.nolus-token') }}
          </span
        >
        <div class="inline-flex items-center bg-light-grey radius-rounded text-14 text-primary nls-font-400 m-0 p-1">
          <img
            class="inline-block w-4 h-4 mr-1 my-0"
            :src="DEFAULT_ASSET.icon"
          />
          <span>{{ DEFAULT_ASSET.label }}</span>
        </div>
      </div>
      <div class="block mt-1">
        <p class="text-14 text-primary nls-font-700 m-0">
          {{ modelValue.walletAddress }}
        </p>
        <button
          class="btn btn-secondary btn-medium-secondary flex btn-icon mt-2"
          @click="modelValue.onCopyClick();onCopy()"
        >
          <DocumentDuplicateIcon class="icon w-4 h-4" />
          {{ copyText }}
        </button>
      </div>
    </div>

    <div class="flex justify-center mt-7">
      <div class="inline-block w-[210px] h-[210px] p-4 background border border-standart radius-rounded">
        <qrcode-vue
          :size="180"
          :value="modelValue.walletAddress"
          foreground="#142237"
          render-as="svg"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import QrcodeVue from 'qrcode.vue';
import { onUnmounted, ref, type PropType } from 'vue';
import { ArrowLeftIcon, DocumentDuplicateIcon } from '@heroicons/vue/24/solid';
import { DEFAULT_ASSET } from '@/config/env';
import { useI18n } from 'vue-i18n';

export interface ReceiveQrCodeComponentProps {
  walletAddress: string;
  onBackClick: () => void;
  onCopyClick: (wallet?: string) => void;
}

let timeOut: NodeJS.Timeout;
const i18n = useI18n();
const copyText = ref(i18n.t('message.copy'));

defineProps({
  modelValue: {
    type: Object as PropType<ReceiveQrCodeComponentProps>,
    required: true,
  },
});

onUnmounted(() => {
  clearTimeout(timeOut);
});

const onCopy = () => {
  copyText.value = i18n.t('message.copied');
  if(timeOut){
    clearTimeout(timeOut);
  }
  timeOut = setTimeout(() => {
    copyText.value = i18n.t('message.copy');
  }, 2000);
}
</script>
