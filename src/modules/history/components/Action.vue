<template>
  <Button
    ref="popoverParent"
    severity="tertiary"
    icon="more"
    size="small"
    class="!p-2.5 text-icon-default"
    :class="popoverRef?.isOpen ? 'active' : ''"
    @click="popoverRef?.toggle()"
  />
  <Popover
    ref="popoverRef"
    position="bottom-right"
    :parent="popoverParent"
    :fullscreen-on-mobile="false"
    class="!max-w-[160px]"
  >
    <template #content>
      <button
        class="button-secondary w-full border-none px-3 py-3 text-left"
        @click="
          () => {
            emitter('click');
            popoverRef?.close();
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
import type { IObjectKeys } from "@/common/types";
import type { useHistoryStore } from "@/common/stores/history";
import { TextFormat } from "../../../common/utils";
import { useI18n } from "vue-i18n";

// The store's reactive unwrapping maps class fields (CoinPretty) into a
// structurally different type, so the prop type must be derived from the
// store rather than declared as the raw TransactionEntry.
export type HistoryRowEntry = ReturnType<typeof useHistoryStore>["transactions"][number] & { code?: number };
export type IAction = { transaction: HistoryRowEntry };

const i18n = useI18n();
const popoverRef = ref<InstanceType<typeof Popover> | null>(null);
const popoverParent = ref();
const props = defineProps<IAction>();
const onShowToast = inject("onShowToast", (_data: { type: ToastType; message: string }) => {});
const emitter = defineEmits(["click"]);

function copyHash() {
  if (props.transaction) {
    void TextFormat.copyToClipboard(props.transaction.tx_hash ?? "");
    onShowToast({ type: ToastType.success, message: i18n.t("message.tx-copied-successfully") });
  }
  popoverRef.value?.close();
}

function copyTxRaw() {
  if (props.transaction) {
    const txData = props.transaction.data;
    const item: IObjectKeys = { ...txData };
    const rawMsg = txData?.msg;
    if (rawMsg && (typeof rawMsg === "string" || rawMsg instanceof Uint8Array)) {
      item.msg = JSON.parse(Buffer.from(rawMsg).toString());
    }

    const data = JSON.stringify(item, (key, value) => (typeof value === "bigint" ? value.toString() : value));
    void TextFormat.copyToClipboard(data);
    onShowToast({ type: ToastType.success, message: i18n.t("message.tx-raw-copied-successfully") });
  }
  popoverRef.value?.close();
}
</script>
