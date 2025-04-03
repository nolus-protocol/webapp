<template>
  <Button
    ref="popoverParent"
    severity="tertiary"
    icon="more"
    size="small"
    class="!p-2.5 text-icon-default"
    @click="isOpen = !isOpen"
  />
  <Popover
    v-if="isOpen"
    position="bottom-right"
    :parent="popoverParent"
    @close="isOpen = !isOpen"
    class="max-w-[160px]"
  >
    <template #content>
      <button
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="
          () => {
            emitter('click');
            close();
          }
        "
      >
        {{ $t("message.details") }}
      </button>
      <button
        v-if="!transaction.historyData.skipRoute"
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="copyHash"
      >
        {{ $t("message.btn-tx-hash") }}
      </button>
      <button
        v-if="!transaction.historyData.skipRoute"
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="copyTxRaw"
      >
        {{ $t("message.btn-raw-json") }}
      </button>
    </template>
  </Popover>
</template>

<script lang="ts" setup>
import { inject, ref } from "vue";
import { Button, Popover, ToastType } from "web-components";
import type { ITransactionData } from "@/modules/history/types";
import type { HistoryData } from "@/modules/history/types/ITransaction";
import { StringUtils } from "../../../common/utils";
import { useI18n } from "vue-i18n";

export type IAction = { transaction: ITransactionData & HistoryData };

const i18n = useI18n();
const popoverParent = ref();
const isOpen = ref(false);
const props = defineProps<IAction>();
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});
const emitter = defineEmits(["click"]);

function copyHash() {
  if (props.transaction) {
    StringUtils.copyToClipboard(props.transaction?.tx_hash);
    onShowToast({ type: ToastType.success, message: i18n.t("message.tx-copied-successfully") });
  }
  close();
}

function copyTxRaw() {
  if (props.transaction) {
    const item = { ...props.transaction.data };
    if (props.transaction.data.msg) {
      const msg = JSON.parse(Buffer.from(props.transaction.data.msg).toString());
      item.msg = msg;
    }

    const data = JSON.stringify(item, (key, value) => (typeof value === "bigint" ? value.toString() : value));
    StringUtils.copyToClipboard(data);
    onShowToast({ type: ToastType.success, message: i18n.t("message.tx-raw-copied-successfully") });
  }
  close();
}

function close() {
  isOpen.value = false;
}
</script>
