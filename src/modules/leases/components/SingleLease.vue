<template>
  <SingleLeaseHeader :lease="lease" />
  <div class="flex flex-col gap-8">
    <PriceWidget :lease="lease" />
    <PositionSummaryWidget :lease="lease" />
    <div class="flex flex-col gap-8 md:flex-row">
      <PositionHealthWidget :lease="lease" />
      <StrategiesWidget :lease="lease" />
    </div>
    <LeaseLogWidget :lease="lease" />
  </div>
  <router-view></router-view>
</template>

<script lang="ts" setup>
import SingleLeaseHeader from "./single-lease/SingleLeaseHeader.vue";
import PriceWidget from "./single-lease/PriceWidget.vue";
import PositionSummaryWidget from "./single-lease/PositionSummaryWidget.vue";
import PositionHealthWidget from "./single-lease/PositionHealthWidget.vue";
import LeaseLogWidget from "./single-lease/LeaseLogWidget.vue";
import StrategiesWidget from "./single-lease/StrategiesWidget.vue";
import { useRoute } from "vue-router";
import { useLease } from "@/common/composables";
import { Logger } from "@/common/utils";
import { provide } from "vue";

const route = useRoute();

function reload() {}

const { lease } = useLease(route.params.id as string, route.params.protocol as string, (error) => {
  Logger.error(error);
});

provide("reload", reload);
</script>
