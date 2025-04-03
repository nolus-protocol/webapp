<template>
  <Widget>
    <WidgetHeader
      :label="$t('message.vested')"
      :icon="{ name: 'earn' }"
    />
    <div class="flex flex-col">
      <VestedTable
        class="mb-8"
        :showEmpty="false"
        :vestedTokens="vestedTokens"
      />
    </div>
  </Widget>
</template>

<script lang="ts" setup>
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import { Widget } from "web-components";
import VestedTable from "@/modules/stake/components/VestedTable.vue";

defineProps<{
  vestedTokens: { endTime: string; amount: { amount: string; denom: string } }[];
}>();
</script>
