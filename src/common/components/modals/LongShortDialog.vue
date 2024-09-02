<template>
  <DialogHeader
    :active-tab="activeTab()"
    :headerList="[$t('message.long'), $t('message.short')]"
    :routes="routes"
  >
    <template #tab-1>
      <LongMainComponent :selectedAsset="selectedAsset" />
    </template>
    <template #tab-2>
      <ShortMainComponent :selectedAsset="selectedAsset" />
    </template>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from "@/common/components/modals/templates/DialogHeader.vue";
import LongMainComponent from "./long/LongMainComponent.vue";
import ShortMainComponent from "./short/ShortMainComponent.vue";

const routes = ["long", "short"];

const props = defineProps({
  route: {
    type: String
  },
  selectedAsset: {
    type: String
  }
});

const activeTab = () => {
  const index = routes.indexOf(props.route as string);

  if (index < 0) {
    return 1;
  }

  return index + 1;
};
</script>
