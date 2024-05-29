<template>
  <DialogHeader
    :active-tab="activeTab()"
    :headerList="[$t('message.receive'), $t('message.send')]"
    :routes="routes"
  >
    <template #tab-1>
      <ReceiveComponent />
    </template>
    <template #tab-2>
      <SendMainComponent />
    </template>
  </DialogHeader>
</template>
v2
<script lang="ts" setup>
import SendMainComponent from "./sendV2/SendMainComponent.vue";
import ReceiveComponent from "./receiveV2/ReceiveComponent.vue";
import DialogHeader from "./templates/DialogHeader.vue";

const routes = ["receiveV2", "sendV2"];

const props = defineProps({
  route: {
    type: String
  },
  dialogSelectedCurrency: {
    type: String,
    default: ""
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
