<template>
  <Widget>
    <WidgetHeader
      :label="$t('message.price')"
      :icon="{ name: 'line-chart', class: 'fill-icon-link' }"
    >
      <div class="flex items-center gap-3">
        <span>{{ $t("message.period") }}:</span>
        <Dropdown
          id="price"
          :on-select="
            (data) => {
              chartTimeRange = data;
            }
          "
          :options="options"
          :selected="options[0]"
          class="w-20"
          dropdownPosition="right"
          dropdownClassName="min-w-10"
        />
      </div>
    </WidgetHeader>
    <PriceOverTimeChart
      :lease="lease"
      :interval="chartTimeRange.days"
    />
  </Widget>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { Dropdown, Widget } from "web-components";
import { CHART_RANGES } from "@/config/global";
import type { LeaseInfo } from "@/common/api";
import type { LeaseDisplayData } from "@/common/stores/leases";

import WidgetHeader from "@/common/components/WidgetHeader.vue";
import PriceOverTimeChart from "./PriceOverTimeChart.vue";

defineProps<{
  lease?: LeaseInfo | null;
  displayData?: LeaseDisplayData | null;
}>();

const chartTimeRange = ref(CHART_RANGES["1"]);

const options = Object.values(CHART_RANGES).map((value) => ({
  ...value,
  value: value.label
}));
</script>
