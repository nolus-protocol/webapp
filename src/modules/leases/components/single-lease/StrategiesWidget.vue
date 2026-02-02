<template>
  <Widget class="flex-1"
    ><WidgetHeader
      :label="$t('message.strategies')"
      :icon="{ name: 'strategy', class: 'fill-icon-link' }"
    />
    <EmptyState
      v-if="leaseStatus == TEMPLATES.opening"
      :slider="[
        {
          image: { name: 'strategies' },
          title: $t('message.position-strategy-empty'),
          description: $t('message.position-strategy-empty-description'),
          link: {
            label: $t('message.position-strategy-empty-link'),
            url: `/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}/learn-summary`,
            tooltip: { content: $t('message.position-strategy-empty-tooltip') }
          }
        }
      ]"
    />
    <div
      v-else
      class="flex flex-col gap-2"
    >
      <div
        v-for="(strategy, index) in strategies"
        :key="index"
        class="flex cursor-pointer items-start justify-between rounded-lg border border-border-color p-4"
      >
        <Toggle
          :id="`theme-toggle-${index}`"
          class="mr-3"
          @click="show(index)"
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
import { ref, computed } from "vue";
import { Toggle, Widget } from "web-components";
import { getLeaseStatus, TEMPLATES } from "../common";
import type { LeaseInfo } from "@/common/api";
import { RouteNames } from "@/router";
import { useRoute } from "vue-router";

import WidgetHeader from "@/common/components/WidgetHeader.vue";
import WatcherIcon from "@/assets/icons/lease/watcher.svg";
import ActivateStrategyDialog from "@/modules/leases/components/single-lease/ActivateStrategyDialog.vue";
import EmptyState from "@/common/components/EmptyState.vue";

const route = useRoute();
const strategyDialogRef = ref<typeof ActivateStrategyDialog | null>(null);
const props = defineProps<{
  lease?: LeaseInfo | null;
}>();

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

function show(index: number) {
  strategyDialogRef.value?.[index]?.show();
}

const leaseStatus = computed(() => {
  return getLeaseStatus(props.lease);
});
</script>
