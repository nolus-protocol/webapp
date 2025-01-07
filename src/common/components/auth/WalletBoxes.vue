<template>
  <button
    class="button button-secondary flex justify-start gap-2 rounded-lg p-4 text-14 font-semibold"
    type="button"
    :disabled="disabled"
    @click="onClick"
  >
    <icon />
    {{ label }}
    <Spinner
      v-if="disabled"
      height="20"
      width="20"
    />
  </button>
</template>

<script lang="ts" setup>
import { useWalletStore, WalletActions } from "@/common/stores/wallet";
import { Logger } from "@/common/utils";
import { inject, ref, type Component } from "vue";
import { useI18n } from "vue-i18n";
import { Spinner, ToastType } from "web-components";

const disabled = ref(false);
const wallet = useWalletStore();
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});
const i18n = useI18n();

const props = defineProps<{
  label?: string;
  icon?: Component | string;
  type?: WalletActions;
}>();

async function onClick() {
  try {
    disabled.value = true;
    await wallet[props.type as WalletActions]?.();
    onShowToast({
      type: ToastType.success,
      message: i18n.t("message.wallet-connected")
    });
  } catch (e: Error | any) {
    Logger.error(e);
  } finally {
    disabled.value = false;
  }
}
</script>
