<template>
  <DialogHeader
    :headerList="[$t('message.delegate-title'), $t('message.undelegate-title')]"
    :routes="routes"
    :active-tab="activeTab()"
  >
    <template #tab-1>
      <DelegateMainComponent :selectedAsset="selectedAsset" />
    </template>
    <template #tab-2>
      <UndelegateMainComponent :selectedAsset="selectedAsset" />
    </template>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DelegateMainComponent from "@/components/DelegateComponents/DelegateMainComponent.vue";
import UndelegateMainComponent from "@/components/UndelegateComponents/UndelegateMainComponent.vue";
import DialogHeader from "./templates/DialogHeader.vue";

const routes = ['delegate', 'undelegate'];

const props = defineProps({
  selectedAsset: {
    type: String,
  },
  route: {
    type: String,
  },
});

const activeTab = () => {
  const index = routes.indexOf(props.route as string);

  if(index < 0){
    return 1;
  }

  return index+1;
}

</script>
