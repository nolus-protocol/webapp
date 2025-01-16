<template>
  <SingleLeaseHeader :lease="lease" />
  <div class="flex flex-col gap-8">
    <Alert
      v-if="status == TEMPLATES.opening"
      :title="$t('message.opening-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.opening-description") }}
        </p>
        <Stepper
          :activeStep="2"
          :steps="steps"
          :variant="StepperVariant.SMALL"
        />
      </template>
    </Alert>
    <Alert
      v-if="loadingClose || loadingCollect"
      :title="$t('message.closing-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.closing-description") }}
        </p>
        <Stepper
          :activeStep="2"
          :steps="steps"
          :variant="StepperVariant.SMALL"
        />
      </template>
    </Alert>

    <Alert
      v-if="loadingRepay"
      :title="$t('message.repaid-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.repaid-description") }}
        </p>
        <Stepper
          :activeStep="2"
          :steps="steps"
          :variant="StepperVariant.SMALL"
        />
      </template>
    </Alert>

    <PriceWidget :lease="lease" />
    <PositionSummaryWidget :lease="lease" />
    <div class="flex flex-col gap-8 md:flex-row">
      <PositionHealthWidget :lease="lease" />
      <StrategiesWidget :lease="lease" />
    </div>
    <LeaseLogWidget
      v-if="(lease?.leaseData?.history?.length ?? 0) > 0"
      :lease="lease"
    />
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
import { computed, onMounted, onUnmounted, provide, ref } from "vue";
import { Alert, AlertType, Stepper, StepperVariant } from "web-components";
import { getStatus, TEMPLATES } from "./common";
import type { LeaseData } from "@/common/types";
import { UPDATE_LEASES } from "@/config/global";

const route = useRoute();
let timeOut: NodeJS.Timeout;

function reload() {
  getLease();
}

const { lease, getLease } = useLease(route.params.id as string, route.params.protocol as string, (error) => {
  Logger.error(error);
});

const steps = [
  {
    label: "Step 1",
    icon: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/currencies/icons/osmosis-nls.svg"
  },
  {
    label: "Step 1",
    icon: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/currencies/icons/osmosis-nls.svg"
  },
  {
    label: "Step 1",
    icon: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/currencies/icons/osmosis-nls.svg",
    approval: true
  },
  {
    label: "Step 1",
    icon: "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/currencies/icons/osmosis-nls.svg"
  }
];

const status = computed(() => {
  return getStatus(lease.value as LeaseData);
});

onMounted(() => {
  timeOut = setInterval(() => {
    getLease();
  }, UPDATE_LEASES);
});

onUnmounted(() => {
  clearInterval(timeOut);
});

const loadingClose = computed(() => {
  const data = lease.value?.leaseStatus.opened;

  if (Object.prototype.hasOwnProperty.call(data?.in_progress ?? {}, "close")) {
    return true;
  }

  return false;
});

const loadingRepay = computed(() => {
  const data = lease.value?.leaseStatus.opened;

  if (Object.prototype.hasOwnProperty.call(data?.in_progress ?? {}, "repayment")) {
    return true;
  }

  return false;
});

const loadingCollect = computed(() => {
  const data = lease.value?.leaseStatus.paid;

  if (data?.in_progress == "transfer_in_init" || data?.in_progress == "transfer_in_finish") {
    return true;
  }

  return false;
});

provide("reload", reload);
</script>
