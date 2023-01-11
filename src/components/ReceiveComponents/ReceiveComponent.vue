<template>
  <div class="modal-send-receive-input-area">
    <div class="block text-left">
      <div class="block mt-[20px]">
        <CurrencyField
          id="amount"
          :currency-options="modelValue?.currentBalance"
          :disabled-currency-picker="false"
          :option="modelValue?.selectedCurrency"
          :value="modelValue?.amount"
          :name="$t('message.amount')"
          :label="$t('message.amount-repay')"
        />
      </div>

      <div class="block mt-[25px]">
        <Picker
          :default-option="networks[0]"
          :options="networks"
          :label="$t('message.network')"
          @update-selected="onUpdateNetwork"
        />
      </div>

      <div class="block mt-[18px]">
        <p class="text-14 nls-font-500 text-primary m-0 mb-[6px]">
          {{ $t("message.address") }}
        </p>
        <p class="text-14 text-primary nls-font-700 m-0 break-all">
          {{ wallet }}
        </p>
        <div class="flex items-center justify-start mt-2">
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon mr-2 flex"
            @click="
              modelValue?.onCopyClick(wallet);
              onCopy();
            "
          >
            <DocumentDuplicateIcon class="icon w-4 h-4" />
            {{ copyText }}
          </button>
          <button
            class="btn btn-secondary btn-medium-secondary btn-icon flex"
            @click="modelValue?.onScanClick"
          >
            <QrCodeIcon class="icon w-4 h-4" />
            {{ $t("message.show-barcode") }}
          </button>
        </div>
      </div>

      <div class="flex justify-between w-full text-light-blue text-[14px] mt-4">
        <p>{{ $t("message.estimate-time") }}:</p>
        <p>-{{ selectedNetwork.estimation }} {{ $t("message.sec") }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref, type PropType, computed } from "vue";
import Picker from "@/components/Picker.vue";
import CurrencyField from "@/components/CurrencyField.vue";
import type { AssetBalance } from "@/stores/wallet/state";
import type { Network } from "@/types";

import { DocumentDuplicateIcon, QrCodeIcon } from "@heroicons/vue/24/solid";
import { SUPPORTED_NETWORKS } from "@/config/env";
import { useI18n } from "vue-i18n";
import { WalletUtils } from "@/utils";

export interface ReceiveComponentProps {
  currentBalance: AssetBalance[];
  selectedCurrency: AssetBalance;
  amount: string;
  onScanClick: () => void;
  onCopyClick: (wallet?: string) => void;
}

let timeOut: NodeJS.Timeout;
const networks = SUPPORTED_NETWORKS;
const i18n = useI18n();
const copyText = ref(i18n.t("message.copy"));
const selectedNetwork = ref(SUPPORTED_NETWORKS[0]);

defineProps({
  modelValue: {
    type: Object as PropType<ReceiveComponentProps>,
  },
});

onUnmounted(() => {
  clearTimeout(timeOut);
});

const onUpdateNetwork = (event: Network) => {
  selectedNetwork.value = event;
};

const wallet = computed(() => {
  return WalletUtils.transformWallet(selectedNetwork.value.prefix);
});

const onCopy = () => {
  copyText.value = i18n.t("message.copied");
  if (timeOut) {
    clearTimeout(timeOut);
  }
  timeOut = setTimeout(() => {
    copyText.value = i18n.t("message.copy");
  }, 2000);
};
</script>
