<template>
  <Dialog
    ref="dialog"
    :title="title"
    :tabs="[{ label: $t('message.swap') }, { label: $t('message.receive') }, { label: $t('message.send') }]"
    showClose
    @close-dialog="
      () => {
        const path = route.matched[1].path ?? '/';
        router.push(path);
      }
    "
    @change-tab="onChangeTab"
    :activeTabIndex="activeTabIndex"
  >
    <template #tab-content-0>
      <SwapForm />
    </template>
    <template #tab-content-1>
      <ReceiveForm />
    </template>
    <template #tab-content-2>
      <SendForm />
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Dialog } from "web-components";
import { AssetsDialog } from "@/modules/assets/enums";
import { SwapForm, SendForm, ReceiveForm } from "./index";
import { useI18n } from "vue-i18n";

const route = useRoute();
const router = useRouter();
const dialog = ref<typeof Dialog | null>(null);
const i18n = useI18n();

onMounted(() => {
  dialog?.value?.show();
});

onBeforeUnmount(() => {
  dialog?.value?.close();
});

const activeTabIndex = computed(() => {
  const tab = route.params.tab as string;
  if (tab === AssetsDialog.SWAP) return 0;
  if (tab === AssetsDialog.RECEIVE) return 1;
  if (tab === AssetsDialog.SEND) return 2;

  return 0;
});

const title = computed(() => {
  const tab = route.params.tab as string;

  if (tab === AssetsDialog.SWAP) return i18n.t("message.swap");
  if (tab === AssetsDialog.RECEIVE) return i18n.t("message.receive");
  if (tab === AssetsDialog.SEND) return i18n.t("message.send");

  return i18n.t("message.transfer");
});

function onChangeTab(event: number) {
  let path = route.matched[1].path ?? "/";

  if (path == "/") {
    path = "";
  }

  switch (event) {
    case 0: {
      return router.push(`${path}/${AssetsDialog.SWAP}`);
    }
    case 1: {
      return router.push(`${path}/${AssetsDialog.RECEIVE}`);
    }
    case 2: {
      return router.push(`${path}/${AssetsDialog.SEND}`);
    }
  }
}
</script>
