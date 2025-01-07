<template>
  <Widget class="flex-1"
    ><WidgetHeader
      :label="$t('message.strategies')"
      :icon="{ name: 'strategy', class: 'fill-icon-link' }"
    />
    <div class="flex flex-col gap-2">
      <div
        v-for="(strategy, index) in strategies"
        :key="index"
        class="flex cursor-pointer items-start justify-between rounded-lg border border-border-color p-4"
      >
        <Toggle
          :id="`theme-toggle-${index}`"
          class="mr-3"
          @click="() => $refs.strategyDialogRef[index]?.show()"
        />
        <div class="flex flex-1 flex-col gap-1">
          <div class="text-14 font-semibold text-typography-default">{{ strategy.heading }}</div>
          <div class="text-14 font-normal text-typography-secondary">{{ strategy.content }}</div>
        </div>
        <component :is="strategy.icon"></component>
        <ActivateStrategyDialog
          ref="strategyDialogRef"
          :strategy="strategy"
        />
      </div>
    </div>
  </Widget>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { Toggle, Widget } from "web-components";
import WidgetHeader from "@/common/components/WidgetHeader.vue";

import WatcherIcon from "@/assets/icons/lease/watcher.svg";
import ActivateStrategyDialog from "@/modules/leases/components/single-lease/ActivateStrategyDialog.vue";

const strategyDialogRef = ref<typeof ActivateStrategyDialog | null>(null);

const strategies = [
  {
    heading: "Shield the position from liquidations",
    content: "Automate lease interest repayments",
    icon: WatcherIcon
  },
  {
    heading: "Automate lease interest repayments",
    content: "Automate lease interest repayments",
    icon: WatcherIcon
  },
  { heading: "Earn +3% APY", content: "Automate lease interest repayments", icon: WatcherIcon }
];
</script>

<style scoped lang=""></style>
