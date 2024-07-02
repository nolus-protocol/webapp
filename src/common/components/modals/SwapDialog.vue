<template>
  <DialogHeader :headerList="[$t('message.swap')]">
    <SwapMainComponent :data="props.data" />
  </DialogHeader>
</template>

<script lang="ts" setup>
import DialogHeader from "@/common/components/modals/templates/DialogHeader.vue";
import SwapMainComponent from "@/common/components/modals/swap/SwapMainComponent.vue";
import type { PropType } from "vue";
import type { IObjectKeys } from "@/common/types";

const props = defineProps({
  data: {
    type: Object as PropType<IObjectKeys | null>
  }
});
</script>
