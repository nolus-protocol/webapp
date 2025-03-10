<template>
  <Dialog
    ref="dialog"
    show-close
    :title="$t('message.disconnect-title')"
    class-list="md:h-auto"
  >
    <template v-slot:content>
      <div class="px-6 pb-6">
        <div class="label flex items-center gap-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.disconnect-body") }}
        </div>

        <div class="my-4 flex w-full items-center justify-between rounded-md bg-neutral-bg-1 px-4 py-2">
          <div class="flex w-full gap-2">
            <img
              width="32"
              :src="NolusIcon"
            />
            <div class="flex flex-col text-typography-secondary">
              <span class="text-14 font-semibold">
                {{
                  isMobile()
                    ? StringUtils.truncateString(wallet?.wallet?.address ?? "", 8, 8)
                    : StringUtils.truncateString(wallet?.wallet?.address ?? "", 16, 16)
                }}
              </span>
              <span class="text-12 font-normal">{{ NATIVE_NETWORK.label }}</span>
            </div>
            <div class="flex flex-1 items-center justify-end">
              <button
                class="wallet-action"
                @click="onCopy"
              >
                <SvgIcon name="copy" />
              </button>
            </div>
          </div>
        </div>

        <div class="label flex items-center gap-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.disconnect-body-btm") }}
        </div>
      </div>

      <hr class="border-border-color" />

      <div class="flex flex-col justify-end gap-2 p-6 md:flex-row">
        <Button
          size="large"
          severity="tertiary"
          :label="$t('message.cancel')"
          @click="close"
        />

        <Button
          size="large"
          severity="danger"
          :label="$t('message.disconnect')"
          @click="onClickDisconnect"
        />
      </div>
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import NolusIcon from "@/assets/icons/coins/nls.svg?url";
import { inject, onBeforeUnmount, ref } from "vue";
import { Dialog, ToastType, SvgIcon, Button } from "web-components";
import { NATIVE_NETWORK } from "@/config/global";
import { useWalletStore, WalletActions } from "@/common/stores/wallet";
import { Logger, StringUtils, WalletManager, isMobile } from "@/common/utils";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { RouteNames } from "@/router";
import { ApplicationActions, useApplicationStore } from "@/common/stores/application";

const wallet = useWalletStore();
const dialog = ref();
const i18n = useI18n();
const router = useRouter();
const application = useApplicationStore();

const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

onBeforeUnmount(() => {
  dialog?.value?.close();
});

function show() {
  dialog.value?.show();
}

function close() {
  dialog.value?.close();
}

async function onCopy() {
  StringUtils.copyToClipboard(wallet?.wallet?.address ?? "");
  onShowToast({
    type: ToastType.success,
    message: i18n.t("message.address-coppied")
  });
}

async function onClickDisconnect() {
  try {
    close();
    router.push({ name: RouteNames.DASHBOARD });
    WalletManager.eraseWalletInfo();
    wallet[WalletActions.DISCONNECT]();
    onShowToast({
      type: ToastType.success,
      message: i18n.t("message.wallet-disconnected")
    });
    await application[ApplicationActions.CHANGE_NETWORK]();
  } catch (error) {
    Logger.error(error);
  }
}

defineExpose({ show });
</script>
