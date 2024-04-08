<template>
  <DialogHeader
    :active-tab="activeTab()"
    :headerList="[$t('message.delegate-title'), $t('message.undelegate-title')]"
    :routes="routes"
  >
    <template #tab-1>
      <DelegateMainComponent />
    </template>
    <template #tab-2>
      <UndelegateMainComponent />
    </template>
  </DialogHeader>
</template>

<script lang="ts" setup>
import DelegateMainComponent from "./delegate/DelegateMainComponent.vue";
import UndelegateMainComponent from "./undelegate/UndelegateMainComponent.vue";
import DialogHeader from "./templates/DialogHeader.vue";

const routes = ["delegate", "undelegate"];

const props = defineProps({
  route: {
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
