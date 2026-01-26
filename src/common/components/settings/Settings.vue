<template>
  <Button
    ref="popoverParent"
    severity="tertiary"
    icon="cogwheel"
    size="small"
    class="text-icon-default"
    @click="isOpen = !isOpen"
  />
  <Popover
    v-if="isOpen"
    position="bottom-right"
    :parent="popoverParent"
    :title="$t('message.settings')"
    @close="isOpen = !isOpen"
    class="md:max-w-[394px]"
  >
    <template #title-content>
      <Button
        severity="tertiary"
        icon="bell"
        size="icon"
        v-if="wallet.wallet"
        @click="subscribeWallet"
      />
    </template>
    <template #content>
      <!-- <AvatarSettings /> -->

      <ThemeSettings />
    </template>
  </Popover>
</template>

<script lang="ts" setup>
import { inject, ref } from "vue";
import { Button, Popover, ToastType } from "web-components";

// import AvatarSettings from "./AvatarSettings.vue";
import ThemeSettings from "./ThemeSettings.vue";
import { useWalletStore } from "@/common/stores/wallet";
import { notificationSubscribe } from "../../../push/lib";
import { useI18n } from "vue-i18n";

enum Subscription {
  subscribed = "subscribed",
  unsubscribed = "unsubscribed"
}

const popoverParent = ref();
const isOpen = ref(false);
const wallet = useWalletStore();
const i18n = useI18n();

const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

async function subscribeWallet() {
  try {
    const data = await notificationSubscribe(wallet?.wallet?.address);
    switch (data) {
      case Subscription.subscribed: {
        onShowToast({ type: ToastType.success, message: i18n.t("message.subscribed") });

        break;
      }
      case Subscription.unsubscribed: {
        onShowToast({ type: ToastType.success, message: i18n.t("message.unsubscribed") });
        break;
      }
    }
  } catch (e) {
    console.log(e);
  }
}
</script>

<style scoped lang=""></style>
