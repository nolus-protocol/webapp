<template>
  <Dialog
    ref="dialog"
    :title="activeTabIndex ? $t('message.undelegate') : $t('message.delegate')"
    :tabs="[{ label: $t('message.delegate') }, { label: $t('message.undelegate') }]"
    showClose
    @change-tab="onChangeTab"
    @close-dialog="
      () => {
        router.push(`/${RouteNames.STAKE}`);
      }
    "
    :activeTabIndex="activeTabIndex"
  >
    <template #tab-content-0>
      <DelegateUndelegateStakeForm :type="StakeDialog.DELEGATE" />
    </template>
    <template #tab-content-1>
      <DelegateUndelegateStakeForm :type="StakeDialog.UNDELEGATE" />
    </template>
  </Dialog>
</template>

<script lang="ts" setup>
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Dialog } from "web-components";

import { RouteNames } from "@/router";
import { StakeDialog } from "@/modules/stake/enums";
import DelegateUndelegateStakeForm from "./DelegateUndelegateStakeForm.vue";

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

  if (tab === StakeDialog.DELEGATE) return 0;
  if (tab === StakeDialog.UNDELEGATE) return 1;

  return 0;
});

function onChangeTab(event: number) {
  switch (event) {
    case 0: {
      return router.push(`/${RouteNames.STAKE}/${StakeDialog.DELEGATE}`);
    }
    case 1: {
      return router.push(`/${RouteNames.STAKE}/${StakeDialog.UNDELEGATE}`);
    }
  }
}
</script>

<style scoped lang=""></style>
