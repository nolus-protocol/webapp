<template>
  <Dialog
    ref="dialog"
    :title="$t('message.transaction-details')"
    showClose
    class-list="md:h-auto"
  >
    <template v-slot:content>
      <div class="flex flex-col gap-5 px-6 pb-6 text-typography-default">
        <Alert
          v-if="data?.historyData.skipRoute && data?.historyData?.status != CONFIRM_STEP.SUCCESS"
          :title="data?.historyData.errorMsg ? $t('message.alert-tx-details') : $t('message.additional-confirm')"
          :type="data?.historyData.errorMsg ? AlertType.error : AlertType.warning"
        >
          <template v-slot:content>
            <p class="my-1 break-all text-14 font-normal text-typography-secondary">
              {{ data?.historyData.errorMsg ?? $t("message.additional-confirm-text") }}
            </p>
            <div class="mt-2 flex gap-2">
              <Button
                :label="$t('message.sign-and-continue')"
                severity="secondary"
                size="small"
                :loading="data?.historyData?.status == CONFIRM_STEP.PENDING"
                :disabled="data?.historyData.errorMsg ? true : false"
              />
            </div>
          </template>
        </Alert>

        <span v-if="data?.historyData?.msg">{{ data?.historyData.msg }}</span>
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

          <hr
            v-if="fee || !data?.historyData.skipRoute"
            class="border-t border-border-color"
          />
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
          <div
            class="flex flex-col"
            v-if="!data?.historyData.skipRoute"
          >
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
        <template v-if="data?.historyData?.routeDetails">
          <p class="font-semibold text-typography-default">
            {{ $t("message.transactions-summary") }}
          </p>
          <Stepper
            v-bind="data?.historyData?.routeDetails"
            :variant="StepperVariant.MEDIUM"
          />
        </template>
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import nlsIcon from "@/assets/icons/networks/nolus.svg?url";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import { computed, inject, onBeforeUnmount, ref, h } from "vue";
import { Button, Dialog, ToastType } from "web-components";
import type { ITransactionData } from "@/modules/history/types";
import type { HistoryData } from "@/modules/history/types/ITransaction";
import { AssetUtils, StringUtils } from "@/common/utils";
import { useI18n } from "vue-i18n";
import { CONFIRM_STEP, CURRENCY_VIEW_TYPES } from "@/common/types";
import { useWalletStore } from "@/common/stores/wallet";
import { StepperVariant, Stepper, Alert, AlertType } from "web-components";

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
    const item = { ...data.value.data };
    if (data.value.data.msg) {
      const msg = JSON.parse(Buffer.from(data.value.data.msg).toString());
      item.msg = msg;
    }

    const params = JSON.stringify(item, (key, value) => (typeof value === "bigint" ? value.toString() : value));
    StringUtils.copyToClipboard(params);
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
