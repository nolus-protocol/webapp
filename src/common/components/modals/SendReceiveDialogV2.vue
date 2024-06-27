<template>
  <DialogHeader
    :active-tab="activeTab()"
    :headerList="[$t('message.receive'), $t('message.send')]"
    :routes="routes"
  >
    <template #tab-1>
      <ReceiveComponent :data="props.data" />
    </template>
    <template #tab-2>
      <SendMainComponent :data="props.data" />
    </template>
  </DialogHeader>
</template>
v2
<script lang="ts" setup>
import SendMainComponent from "./sendV2/SendMainComponent.vue";
import ReceiveComponent from "./receiveV2/ReceiveComponent.vue";
import DialogHeader from "./templates/DialogHeader.vue";
import type { IObjectKeys } from "@/common/types";
import type { PropType } from "vue";

const routes = ["receive", "send"];

const props = defineProps({
  route: {
    type: String
  },
  dialogSelectedCurrency: {
    type: String,
    default: ""
  },
  data: {
    type: Object as PropType<IObjectKeys | null>
  }
});

const activeTab = () => {
  const index = routes.indexOf(props.route?.toLocaleLowerCase() as string);

  if (index < 0) {
    return 1;
  }

  return index + 1;
};
</script>
