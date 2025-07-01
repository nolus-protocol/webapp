<template>
  <button
    class="button button-secondary flex justify-start gap-2 rounded-lg p-4 text-14 font-semibold"
    type="button"
    :disabled="disabled"
    @click="onClick"
  >
    <img
      width="32"
      :src="icon"
    />
    {{ label }}
    <Spinner
      v-if="disabled"
      height="20"
      width="20"
    />
  </button>
  <div
    class="m-auto w-[250px] overflow-hidden rounded-lg"
    v-html="qrCode"
  />
</template>

<script lang="ts" setup>
import QRCode from "qrcode";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";
import { Logger } from "@/common/utils";
import { computed, inject, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Spinner, ToastType } from "web-components";
import { useApplicationStore } from "@/common/stores/application";

const disabled = ref(false);
const wallet = useWalletStore();
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});
const i18n = useI18n();
const application = useApplicationStore();
const colors = computed(() => {
  switch (application.theme) {
    case "dark": {
      return {
        dark: "#fff",
        light: "#1e242f"
      };
    }
    case "light": {
      return {
        dark: "#1e242f",
        light: "#fff"
      };
    }
    default: {
      return {
        dark: "#1e242f",
        light: "#fff"
      };
    }
  }
});

const text = ref("");
const qrCode = ref("");

watch(text, async (val) => {
  qrCode.value = await QRCode.toString(val, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1,
    color: { dark: colors.value.dark, light: colors.value.light }
  });
});

const props = defineProps<{
  label?: string;
  icon?: string;
  type?: WalletActions;
}>();

async function onClick() {
  try {
    disabled.value = true;
    switch (props.type) {
      // case WalletActions.CONNECT_WC: {
      //   await wallet[props.type as WalletActions.CONNECT_WC]?.((uri: string) => {
      //     // text.value = uri;
      //   });
      //   break;
      // }
      default: {
        await wallet[props.type as WalletActions]?.();
        break;
      }
    }

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
