<template>
  <div class="modal-send-receive-input-area">
    <div class="block text-left">
      <div class="block">
        <Picker 
          :default-option="assets[0]" 
          :disabled="true" 
          :options="assets" 
          :label="$t('message.asset')" 
          />
      </div>

      <div class="block mt-[25px]">
        <Picker 
          :default-option="networks[0]" 
          :disabled="true" 
          :options="networks" 
          :label="$t('message.network')" 
          />
      </div>

      <div class="block mt-[36px]">
        <p class="text-14 nls-font-500 text-primary m-0">
          {{ $t("message.wallet-address") }}
        </p>
        <p class="text-14 text-primary nls-font-700 m-0">
          {{ modelValue?.walletAddress }}
        </p>
        <div class="flex items-center justify-start mt-2">
          <button class="btn btn-secondary btn-medium-secondary btn-icon mr-2" @click="modelValue?.onCopyClick">
            <DocumentDuplicateIcon class="icon w-4 h-4" />
            {{ $t("message.copy") }}
          </button>
          <button class="btn btn-secondary btn-medium-secondary btn-icon" @click="modelValue?.onScanClick">
            <QrCodeIcon class="icon w-4 h-4" />
            {{ $t("message.scan-code") }}
          </button>
        </div>
      </div>

      <WarningBox :isWarning="true" class="mt-[25px]">
        <template v-slot:icon>
          <img class="block mx-auto my-0 w-5 h-5" src="@/assets/icons/info.svg" />
        </template>
        <template v-slot:content >
          <div v-html="$t('message.send-only')">
          </div>
        </template>
      </WarningBox>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import Picker from '@/components/Picker.vue';
import WarningBox from '@/components/modals/templates/WarningBox.vue';

import { DocumentDuplicateIcon, QrCodeIcon } from '@heroicons/vue/24/solid';
import { DEFAULT_NETWORK, DEFAULT_ASSET } from '@/config/env';

export interface ReceiveComponentProps {
  walletAddress: string;
  onScanClick: () => void;
  onCopyClick: () => void;
}

const networks = [DEFAULT_NETWORK];
const assets = [DEFAULT_ASSET];

defineProps({
  modelValue: {
    type: Object as PropType<ReceiveComponentProps>,
  },
});
</script>
