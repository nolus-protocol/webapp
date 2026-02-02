<template>
  <SingleLeaseHeader
    :lease="lease"
    :display-data="displayData"
    :loading="
      status == TEMPLATES.opening ||
      loadingClose ||
      loadingOngoingPartialLiquidation ||
      loadingFullPartialLiquidation ||
      loadingOngoingPartialLiquidationLiability ||
      loadingOngoingFullLiquidationLiability ||
      loadintSlippageProtection
    "
  />
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
      :title="$t('message.close-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.close-description") }}
        </p>
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
      </template>
    </Alert>

    <Alert
      v-if="loadingOngoingPartialLiquidation"
      :title="$t('message.liquidation-ongoingpartial-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.liquidation-ongoingpartial-description") }}
          <a
            @click="
              () => {
                router.push(`/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}/interest-collection`);
              }
            "
            class="cursor-pointer font-normal text-typography-link"
          >
            {{ $t("message.liquidation-ongoingpartial-description-link") }}
          </a>
        </p>
      </template>
    </Alert>

    <Alert
      v-if="loadingFullPartialLiquidation"
      :title="$t('message.liquidation-ongoinfull-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.liquidation-ongoinfull-description") }}
          <a
            @click="
              () => {
                router.push(`/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}/interest-collection`);
              }
            "
            class="cursor-pointer font-normal text-typography-link"
          >
            {{ $t("message.liquidation-ongoinfull-description-link") }}
          </a>
        </p>
      </template>
    </Alert>

    <Alert
      v-if="loadingOngoingPartialLiquidationLiability"
      :title="$t('message.liquidation-ongoingpartial-liability-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.liquidation-ongoingpartial-liability-description") }}
          <a
            @click="
              () => {
                router.push(`/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}/liquidation-partial`);
              }
            "
            class="cursor-pointer font-normal text-typography-link"
          >
            {{ $t("message.liquidation-ongoingpartial-liability-description-link") }}
          </a>
        </p>
      </template>
    </Alert>

    <Alert
      v-if="loadingOngoingFullLiquidationLiability"
      :title="$t('message.liquidation-ongoingfull-liability-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.liquidation-ongoingfull-liability-description") }}
          <a
            @click="
              () => {
                router.push(`/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}/liquidation-full`);
              }
            "
            class="cursor-pointer font-normal text-typography-link"
          >
            {{ $t("message.liquidation-ongoingfull-liability-description-link") }}
          </a>
        </p>
      </template>
    </Alert>

    <Alert
      v-if="loadintSlippageProtection"
      :title="$t('message.market-anomaly-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.market-anomaly-title-desc") }}
          <a class="cursor-pointer font-normal text-typography-link">
            {{ $t("message.market-anomaly-title-desc-link") }}
          </a>
        </p>
      </template>
    </Alert>

    <PriceWidget :lease="lease" :display-data="displayData" />
    <PositionSummaryWidget
      :lease="lease"
      :display-data="displayData"
      :loading="
        loadingClose ||
        loadingOngoingPartialLiquidation ||
        loadingFullPartialLiquidation ||
        loadingOngoingPartialLiquidationLiability ||
        loadingOngoingFullLiquidationLiability
      "
    />
    <div class="flex flex-col gap-8 md:flex-row">
      <PositionHealthWidget
        :lease="lease"
        :display-data="displayData"
        :loading="
          status == TEMPLATES.opening ||
          loadingClose ||
          loadingOngoingPartialLiquidation ||
          loadingFullPartialLiquidation ||
          loadingOngoingPartialLiquidationLiability ||
          loadingOngoingFullLiquidationLiability
        "
      />
      <!-- <StrategiesWidget :lease="lease" /> -->
    </div>
    <template v-if="lease?.etl_data">
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
import { useRoute, useRouter } from "vue-router";
import { Logger } from "@/common/utils";
import { computed, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { Alert, AlertType, Stepper, StepperVariant } from "web-components";
import { TEMPLATES } from "./common";
import { Contracts, NATIVE_NETWORK, UPDATE_LEASES } from "@/config/global";
import { RouteNames } from "@/router";
import { useLeasesStore, type LeaseDisplayData } from "@/common/stores/leases";
import type { LeaseInfo } from "@/common/api";

const route = useRoute();
const router = useRouter();
const leasesStore = useLeasesStore();

let timeOut: NodeJS.Timeout;

// Lease state
const lease = ref<LeaseInfo | null>(null);
const leaseAddress = computed(() => route.params.id as string);
const protocol = computed(() => (route.params.protocol as string).toUpperCase());

// Computed display data for child components
const displayData = computed<LeaseDisplayData | null>(() => {
  if (!lease.value) return null;
  return leasesStore.getLeaseDisplayData(lease.value);
});

async function getLease() {
  try {
    const result = await leasesStore.fetchLeaseDetails(leaseAddress.value, protocol.value);
    if (result) {
      lease.value = result;
    }
  } catch (error) {
    Logger.error(error);
  }
}

function reload() {
  getLease();
}

const steps = computed(() => {
  const protocolIcon = getProtocolIcon()!;

  return [
    {
      label: "",
      icon: NATIVE_NETWORK.icon
    },
    {
      label: "",
      icon: protocolIcon
    },
    {
      label: "",
      icon: protocolIcon
    }
  ];
});

const status = computed(() => {
  if (!lease.value) return TEMPLATES.opening;
  switch (lease.value.status) {
    case "opening": return TEMPLATES.opening;
    case "opened": return TEMPLATES.opened;
    case "paid_off": return TEMPLATES.paid;
    case "closing": return TEMPLATES.paid; // closing shows as paid template
    case "closed": return TEMPLATES.closed;
    case "liquidated": return TEMPLATES.liquidated;
    default: return TEMPLATES.opening;
  }
});

const openingSubState = computed(() => {
  if (!lease.value || lease.value.status !== "opening") {
    return 1;
  }
  
  const inProgress = lease.value.in_progress;
  if (!inProgress) return 1;
  
  if ("opening" in inProgress) {
    const stage = inProgress.opening.stage;
    if (stage === "open_ica_account") return 1;
    if (stage === "transfer_out" || stage === "buy_asset") return 2;
  }
  
  return 3;
});

onMounted(() => {
  getLease();
  timeOut = setInterval(() => {
    getLease();
  }, UPDATE_LEASES);
});

onUnmounted(() => {
  clearInterval(timeOut);
});

// Watch for route changes
watch(
  () => route.params.id,
  () => getLease()
);

const loadingClose = computed(() => {
  return displayData.value?.inProgressType === "close";
});

const loadingRepay = computed(() => {
  return displayData.value?.inProgressType === "repayment";
});

const loadingCollect = computed(() => {
  return displayData.value?.inProgressType === "transfer_in";
});

const loadingOngoingPartialLiquidation = computed(() => {
  if (!lease.value?.in_progress) return false;
  if ("liquidation" in lease.value.in_progress) {
    return lease.value.in_progress.liquidation.cause === "overdue";
  }
  return false;
});

const loadingFullPartialLiquidation = computed(() => {
  return false;
});

const loadingOngoingPartialLiquidationLiability = computed(() => {
  if (!lease.value?.in_progress) return false;
  if ("liquidation" in lease.value.in_progress) {
    return lease.value.in_progress.liquidation.cause === "liability";
  }
  return false;
});

const loadingOngoingFullLiquidationLiability = computed(() => {
  return false;
});

const loadintSlippageProtection = computed(() => {
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
provide("displayData", displayData);
</script>
