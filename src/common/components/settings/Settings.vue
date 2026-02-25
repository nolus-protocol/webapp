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
    class="md:!max-w-[394px]"
  >
    <template #title-content>
      <Button
        severity="tertiary"
        icon="bell"
        size="icon"
        v-if="wallet.wallet"
        :class="isSubscribed ? 'text-primary-50' : 'text-icon-default'"
        @click="toggleSubscription"
      />
    </template>
    <template #content>
      <!-- <AvatarSettings /> -->

      <ThemeSettings />
    </template>
  </Popover>
</template>

<script lang="ts" setup>
import { inject, onMounted, ref } from "vue";
import { Button, Popover, ToastType } from "web-components";

// import AvatarSettings from "./AvatarSettings.vue";
import ThemeSettings from "./ThemeSettings.vue";
import { useWalletStore } from "@/common/stores/wallet";
import { notificationSubscribe, notificationUnsubscribe, getSubscriptionStatus } from "../../../push/lib";
import { useI18n } from "vue-i18n";

const popoverParent = ref();
const isOpen = ref(false);
const isSubscribed = ref(false);
const wallet = useWalletStore();
const i18n = useI18n();

const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});

onMounted(async () => {
  isSubscribed.value = await getSubscriptionStatus();
});

async function toggleSubscription() {
  try {
    if (isSubscribed.value) {
      const success = await notificationUnsubscribe();
      if (success) {
        isSubscribed.value = false;
        onShowToast({ type: ToastType.success, message: i18n.t("message.unsubscribed") });
      }
    } else {
      const result = await notificationSubscribe(wallet?.wallet?.address as string);
      if (result === "permission_denied") {
        onShowToast({ type: ToastType.error, message: i18n.t("message.permission-denied") });
      } else {
        // Check browser state — subscription may succeed even if ETL response is unexpected
        isSubscribed.value = await getSubscriptionStatus();
        if (isSubscribed.value) {
          onShowToast({ type: ToastType.success, message: i18n.t("message.subscribed") });
        }
      }
    }
  } catch (e) {
    console.error("[Settings] Push notification toggle failed:", e);
    onShowToast({ type: ToastType.error, message: i18n.t("message.unexpected-error") });
  }
}
</script>

<style scoped lang=""></style>
