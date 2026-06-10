<template>
  <Dialog
    ref="dialog"
    :title="$t('message.transaction-details')"
    showClose
    class-list="md:h-fit"
  >
    <template v-slot:content>
      <div class="flex flex-col gap-5 px-6 pb-6 text-typography-default">
        <Alert
          v-if="data?.historyData.skipRoute && data?.historyData?.status != CONFIRM_STEP.SUCCESS"
          :title="data?.historyData.errorMsg ? $t('message.alert-tx-details') : $t('message.additional-confirm')"
          :type="data?.historyData.errorMsg ? AlertType.error : AlertType.warning"
        >
          <template v-slot:content>
            <p class="my-1 text-14 font-normal break-all text-typography-secondary">
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
            <span class="text-14 text-typography-secondary">{{ $t("message.status") }}</span>
            <span
              class="flex items-center gap-1 text-typography-error"
              :class="status.class"
              >{{ status.title }}</span
            >
          </div>

          <div class="flex flex-col">
            <span class="text-14 text-typography-secondary">{{ $t("message.account") }}</span>
            <span class="flex items-center gap-1"
              ><img
                v-if="nlsIcon"
                alt=""
                title=""
                :src="nlsIcon"
              />
              {{ TextFormat.truncateString(wallet.wallet?.address ?? "", 6, 6) }}</span
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
            <TokenAmount
              :micro-amount="fee.amount"
              :denom="fee.denom"
              :decimals="fee.decimals"
              :font-size="16"
              class="flex font-semibold"
            />
          </div>
          <div
            class="flex flex-col"
            v-if="!data?.historyData.skipRoute"
          >
            <span class="text-14 text-typography-secondary">{{ $t("message.hash") }}</span>
            <div class="wrap truncate text-16 font-semibold break-all">{{ data?.tx_hash }}</div>
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
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import nlsIcon from "@/assets/icons/networks/nolus.svg?url";
import TokenAmount from "@/common/components/TokenAmount.vue";
import { computed, inject, onBeforeUnmount, ref } from "vue";
import { Button, Dialog, ToastType } from "web-components";
import type { TransactionEntry } from "@/modules/history/types/ITransaction";
import { TextFormat } from "@/common/utils";
import { getCurrencyByDenom } from "@/common/utils/CurrencyLookup";
import { useI18n } from "vue-i18n";
import { CONFIRM_STEP } from "@/common/types";
import { useWalletStore } from "@/common/stores/wallet";
import { Alert, AlertType } from "web-components";

const onShowToast = inject("onShowToast", (_data: { type: ToastType; message: string }) => {});

const dialog = ref<typeof Dialog | null>(null);
const data = ref<TransactionEntry>();
const i18n = useI18n();
const wallet = useWalletStore();
onBeforeUnmount(() => {
  dialog?.value?.close();
});

const fee = computed(() => {
  const entry = data.value;
  if (entry?.fee_denom && entry.fee_amount !== undefined) {
    const currencty = getCurrencyByDenom(entry.fee_denom);
    return {
      denom: currencty.shortName,
      amount: entry.fee_amount,
      decimals: currencty.decimal_digits
    };
  }
  return null;
});

const status = computed(() => {
  switch (data.value?.historyData?.status) {
    case CONFIRM_STEP.PENDING: {
      return {
        title: i18n.t(`message.${CONFIRM_STEP.PENDING}`),
        class: "text-typography-warning"
      };
    }
    case CONFIRM_STEP.ERROR: {
      return {
        title: i18n.t(`message.${CONFIRM_STEP.PENDING}`),
        class: "text-typography-error"
      };
    }
    default: {
      const entry = data.value;
      if (entry && "code" in entry && typeof entry.code === "number" && entry.code !== 0) {
        return {
          title: i18n.t(`message.failed`),
          class: "text-typography-error"
        };
      }
      return {
        title: i18n.t(`message.completed`),
        class: "text-typography-success"
      };
    }
  }
});

function copyHash() {
  const hash = data.value?.tx_hash;
  if (hash !== undefined) {
    void TextFormat.copyToClipboard(hash);
    onShowToast({ type: ToastType.success, message: i18n.t("message.tx-copied-successfully") });
  }
}

function copyTxRaw() {
  const txData = data.value?.data;
  if (txData !== undefined) {
    const item = { ...txData };
    const rawMsg = txData.msg;
    if (rawMsg) {
      if (typeof rawMsg === "string") {
        item.msg = JSON.parse(Buffer.from(rawMsg).toString());
      } else if (rawMsg instanceof Uint8Array) {
        item.msg = JSON.parse(Buffer.from(rawMsg).toString());
      }
    }

    const params = JSON.stringify(item, (key, value) => (typeof value === "bigint" ? value.toString() : value));
    void TextFormat.copyToClipboard(params);
    onShowToast({ type: ToastType.success, message: i18n.t("message.tx-raw-copied-successfully") });
  }
}

defineExpose({
  show: (item: TransactionEntry) => {
    data.value = item;
    dialog?.value?.show();
  }
});
</script>
