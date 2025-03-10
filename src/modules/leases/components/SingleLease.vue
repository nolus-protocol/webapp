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
          :activeStep="openingSubState"
          :steps="steps"
          :variant="StepperVariant.SMALL"
        />
      </template>
    </Alert>
    <Alert
      v-if="loadingClose"
      :title="$t('message.closing-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.closing-description") }}
        </p>
        <Stepper
          :activeStep="closingSubState"
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
          :activeStep="repaySubState"
          :steps="steps"
          :variant="StepperVariant.SMALL"
        />
      </template>
    </Alert>

    <Alert
      v-if="loadingCollect"
      :title="$t('message.collect-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.collect-description") }}
        </p>
        <Stepper
          :activeStep="collectSubState"
          :steps="steps"
          :variant="StepperVariant.SMALL"
        />
      </template>
    </Alert>

    <PriceWidget :lease="lease" />
    <PositionSummaryWidget :lease="lease" />
    <div class="flex flex-col gap-8 md:flex-row">
      <PositionHealthWidget :lease="lease" />
      <!-- <StrategiesWidget :lease="lease" /> -->
    </div>
    <template v-if="lease?.leaseData">
      <LeaseLogWidget :lease="lease" />
    </template>
  </div>
  <router-view></router-view>
  <div
    id="history"
    class="mt-[50px]"
  ></div>
</template>

<script lang="ts" setup>
import SingleLeaseHeader from "./single-lease/SingleLeaseHeader.vue";
import PriceWidget from "./single-lease/PriceWidget.vue";
import PositionSummaryWidget from "./single-lease/PositionSummaryWidget.vue";
import PositionHealthWidget from "./single-lease/PositionHealthWidget.vue";
import LeaseLogWidget from "./single-lease/LeaseLogWidget.vue";
import { useRoute } from "vue-router";
import { useLease } from "@/common/composables";
import { Logger } from "@/common/utils";
import { computed, onMounted, onUnmounted, provide } from "vue";
import { Alert, AlertType, Stepper, StepperVariant } from "web-components";
import { getStatus, TEMPLATES } from "./common";
import type { LeaseData } from "@/common/types";
import { Contracts, NATIVE_NETWORK, UPDATE_LEASES } from "@/config/global";
import type { BuyAssetOngoingState, TransferOutOngoingState } from "@nolus/nolusjs/build/contracts";

const route = useRoute();
const OPENING_CHANNEL = "open_ica_account";

let timeOut: NodeJS.Timeout;

function reload() {
  getLease();
}

const { lease, getLease } = useLease(route.params.id as string, route.params.protocol as string, (error) => {
  Logger.error(error);
});

const steps = computed(() => {
  const protocol = getProtocolIcon()!;
  if (loadingClose.value || loadingRepay.value || loadingCollect.value) {
    return [
      {
        label: "",
        icon: protocol
      },
      {
        label: "",
        icon: NATIVE_NETWORK.icon
      }
    ];
  }

  return [
    {
      label: "",
      icon: NATIVE_NETWORK.icon
    },
    {
      label: "",
      icon: protocol
    },
    {
      label: "",
      icon: protocol
    },
    {
      label: "",
      icon: protocol
    }
  ];
});

const status = computed(() => {
  return getStatus(lease.value as LeaseData);
});

const openingSubState = computed(() => {
  const data = lease.value?.leaseStatus.opening;
  if (OPENING_CHANNEL == data?.in_progress) {
    return 1;
  }

  const state = data?.in_progress as TransferOutOngoingState | BuyAssetOngoingState;

  if ((state as TransferOutOngoingState)?.transfer_out) {
    return 2;
  }

  if ((state as BuyAssetOngoingState)?.buy_asset) {
    return 3;
  }

  return 4;
});

const closingSubState = computed(() => {
  if (loadingClose.value) {
    return 1;
  }

  return 2;
});

const repaySubState = computed(() => {
  if (loadingRepay.value) {
    return 1;
  }

  return 2;
});

const collectSubState = computed(() => {
  if (loadingCollect.value) {
    return 1;
  }

  return 2;
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

function getProtocolIcon() {
  try {
    for (const key in Contracts.protocolsFilter) {
      if (Contracts.protocolsFilter[key].hold.includes(lease.value?.protocol!)) {
        return Contracts.protocolsFilter[key].image;
      }
    }
  } catch (error) {
    console.error("Invalid address format:", error);
    return null;
  }
}

provide("reload", reload);
</script>
