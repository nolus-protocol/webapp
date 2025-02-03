<template>
  <Dialog
    ref="dialog"
    :title="$t('message.transaction-details')"
    showClose
  >
    <template v-slot:content>
      <div class="flex flex-col gap-5 px-6 pb-6 text-typography-default">
        <span>{{ data?.historyData.msg }}</span>
        <div class="flex flex-col gap-3 rounded-lg border border-border-color bg-neutral-bg-1 p-4">
          <div class="flex flex-col">
            <span class="text-14 text-typography-secondary">{{ $t("message.account") }}</span>
            <span class="flex items-center gap-1"
              ><img
                v-if="nlsIcon"
                alt=""
                title=""
                :src="nlsIcon"
              />
              {{ StringUtils.truncateString(wallet.wallet?.address ?? "", 6, 6) }}</span
            >
          </div>

          <div
            v-if="data?.historyData.coin"
            class="flex flex-col"
          >
            <span class="text-14 text-typography-secondary">{{ $t("message.amount") }}</span>
            <span class="flex items-center gap-1 capitalize">{{ data?.historyData.coin }}</span>
          </div>

          <div class="flex flex-col">
            <span class="text-14 text-typography-secondary">{{ $t("message.action") }}</span>
            <span class="flex items-center gap-1 capitalize">{{ data?.historyData?.action }}</span>
          </div>

          <hr class="border-t border-border-color" />
          <div
            class="flex flex-col"
            v-if="fee"
          >
            <span class="text-14 text-typography-secondary">{{ $t("message.fees") }}</span>
            <CurrencyComponent
              :amount="fee.amount"
              :denom="fee.denom"
              :type="CURRENCY_VIEW_TYPES.TOKEN"
              :decimals="fee.decimals"
              :has-space="true"
              :font-size="16"
              :font-size-small="16"
              class="flex font-semibold"
            />
          </div>
          <div class="flex flex-col">
            <span class="text-14 text-typography-secondary">{{ $t("message.hash") }}</span>
            <div class="wrap truncate break-all text-16 font-semibold">{{ data?.tx_hash }}</div>
            <div class="mt-2 flex gap-2">
              <Button
                :label="$t('message.btn-tx-hash')"
                severity="secondary"
                icon="copy"
                iconPosition="left"
                size="small"
                @click="copyHash"
              />
              <Button
                :label="$t('message.btn-raw-json')"
                severity="secondary"
                icon="copy"
                iconPosition="left"
                size="small"
                @click="copyTxRaw"
              />
            </div>
          </div>
        </div>

        <!-- <span
          v-if="data.summary"
          class="text-18 font-semibold"
          >{{ $t("message.transactions-summary") }}</span
        >
        <Stepper
          v-if="data.summary"
          :variant="StepperVariant.MEDIUM"
          v-bind="data.summary"
        /> -->
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { computed, inject, onBeforeUnmount, ref } from "vue";
import { Button, Dialog, ToastType } from "web-components";
import type { ITransactionData } from "@/modules/history/types";
import type { HistoryData } from "@/modules/history/types/ITransaction";
import { AssetUtils, StringUtils } from "@/common/utils";
import { useI18n } from "vue-i18n";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import nlsIcon from "@/assets/icons/networks/nolus.svg?url";
import { useWalletStore } from "@/common/stores/wallet";

const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

const dialog = ref<typeof Dialog | null>(null);
const data = ref<ITransactionData & HistoryData>();
const i18n = useI18n();
const wallet = useWalletStore();

onBeforeUnmount(() => {
  dialog?.value?.close();
});

const fee = computed(() => {
  if (data.value?.fee_denom) {
    const currencty = AssetUtils.getCurrencyByDenom(data.value.fee_denom);
    return {
      denom: currencty.shortName,
      amount: data.value.fee_amount,
      decimals: currencty.decimal_digits
    };
  }
  return null;
});

function copyHash() {
  if (data.value) {
    StringUtils.copyToClipboard(data.value.tx_hash);
    onShowToast({ type: ToastType.success, message: i18n.t("message.tx-copied-successfully") });
  }
}

function copyTxRaw() {
  if (data.value) {
    StringUtils.copyToClipboard(data.value.value);
    onShowToast({ type: ToastType.success, message: i18n.t("message.tx-raw-copied-successfully") });
  }
}

defineExpose({
  show: (item: ITransactionData & HistoryData) => {
    data.value = item;
    dialog?.value?.show();
  }
});
</script>
