<template>
  <Dialog
    ref="dialog"
    :title="activeTabIndex ? $t('message.withdraw') : $t('message.supply')"
    :tabs="[{ label: $t('message.supply') }, { label: $t('message.withdraw') }]"
    showClose
    @close-dialog="
      () => {
        router.push({ name: RouteNames.EARN });
      }
    "
    :activeTabIndex="activeTabIndex"
    @change-tab="onChangeTab"
  >
    <template #tab-content-0>
      <SupplyWithdrawAssetsForm :type="EarnAssetsDialog.SUPPLY" />
    </template>
    <template #tab-content-1>
      <SupplyWithdrawAssetsForm :type="EarnAssetsDialog.WITHDRAW" />
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Dialog } from "web-components";

import { RouteNames } from "@/router";
import { EarnAssetsDialog } from "@/modules/earn/enums";
import SupplyWithdrawAssetsForm from "./SupplyWithdrawAssetsForm.vue";

const route = useRoute();
const router = useRouter();
const dialog = ref<typeof Dialog | null>(null);

onMounted(() => {
  dialog?.value?.show();
});

onBeforeUnmount(() => {
  dialog?.value?.close();
});

const activeTabIndex = computed(() => {
  const tab = route.params.tab as string;

  if (tab === EarnAssetsDialog.SUPPLY) return 0;
  if (tab === EarnAssetsDialog.WITHDRAW) return 1;

  return 0;
});

function onChangeTab(event: number) {
  switch (event) {
    case 0: {
      return router.push(`/${RouteNames.EARN}/${EarnAssetsDialog.SUPPLY}`);
    }
    case 1: {
      return router.push(`/${RouteNames.EARN}/${EarnAssetsDialog.WITHDRAW}`);
    }
  }
}
</script>
