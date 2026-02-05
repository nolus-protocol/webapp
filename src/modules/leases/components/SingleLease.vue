<template>
  <template v-if="!lease">
    <SingleLeaseHeader :loading="true" />
    <div class="flex flex-col gap-8">
      <div class="skeleton-box h-[200px] w-full rounded-lg" />
    </div>
  </template>
  <template v-else>
  <SingleLeaseHeader
    :lease="lease"
    :display-data="displayData"
    :loading="status == TEMPLATES.opening || isInProgress"
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
      v-if="inProgressBanner"
      :title="$t(inProgressBanner.titleKey)"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t(inProgressBanner.descriptionKey) }}
          <a
            v-if="inProgressBanner.link"
            @click="router.push(inProgressBanner.link)"
            class="cursor-pointer font-normal text-typography-link"
          >
            {{ $t(inProgressBanner.linkKey!) }}
          </a>
        </p>
      </template>
    </Alert>

    <PriceWidget :lease="lease" :display-data="displayData" />
    <PositionSummaryWidget
      :lease="lease"
      :display-data="displayData"
      :loading="isInProgress"
    />
    <div class="flex flex-col gap-8 md:flex-row">
      <PositionHealthWidget
        :lease="lease"
        :display-data="displayData"
        :loading="status == TEMPLATES.opening || isInProgress"
      />
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
import { NATIVE_NETWORK, UPDATE_LEASES } from "@/config/global";
import { RouteNames } from "@/router";
import { useLeasesStore, type LeaseDisplayData } from "@/common/stores/leases";
import { useConfigStore } from "@/common/stores/config";
import type { LeaseInfo } from "@/common/api";

const route = useRoute();
const router = useRouter();
const leasesStore = useLeasesStore();
const configStore = useConfigStore();

let timeOut: NodeJS.Timeout;

// Lease state
const lease = ref<LeaseInfo | null>(null);
const leaseAddress = computed(() => route.params.id as string);
const protocol = computed(() => lease.value?.protocol ?? "");

// Computed display data for child components
const displayData = computed<LeaseDisplayData | null>(() => {
  if (!lease.value) return null;
  return leasesStore.getLeaseDisplayData(lease.value);
});

async function getLease() {
  try {
    const result = await leasesStore.fetchLeaseDetails(leaseAddress.value);
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

// Watch for WebSocket-driven store updates (real-time in_progress changes)
watch(
  () => leasesStore.getLease(leaseAddress.value),
  (updated) => {
    if (updated) {
      lease.value = updated;
    }
  }
);

// Redirect to positions list when lease reaches a terminal state
watch(
  () => lease.value?.status,
  (newStatus) => {
    if (newStatus === "closed" || newStatus === "liquidated" || newStatus === "paid_off") {
      leasesStore.refresh().then(() => router.replace(`/${RouteNames.LEASES}`));
    }
  }
);

const isInProgress = computed(() => {
  if (lease.value?.status === "closing") return true;
  const type = displayData.value?.inProgressType;
  if (!type) return false;
  return type === "close" || type === "liquidation";
});

interface InProgressBanner {
  titleKey: string;
  descriptionKey: string;
  link?: string;
  linkKey?: string;
}

const inProgressBanner = computed<InProgressBanner | null>(() => {
  const type = displayData.value?.inProgressType;
  if (!type) return null;

  if (type === "close") {
    return {
      titleKey: "message.close-title",
      descriptionKey: "message.close-description"
    };
  }

  if (type === "repayment") {
    return {
      titleKey: "message.repaid-title",
      descriptionKey: "message.repaid-description"
    };
  }

  if (type === "liquidation") {
    const cause = getLiquidationCause();
    if (cause === "liability") {
      return {
        titleKey: "message.liquidation-ongoingpartial-liability-title",
        descriptionKey: "message.liquidation-ongoingpartial-liability-description",
        link: `/${RouteNames.LEASES}/${route.params.id}/liquidation-partial`,
        linkKey: "message.liquidation-ongoingpartial-liability-description-link"
      };
    }
    // Default to overdue (interest collection) for any liquidation cause
    return {
      titleKey: "message.liquidation-ongoingpartial-title",
      descriptionKey: "message.liquidation-ongoingpartial-description",
      link: `/${RouteNames.LEASES}/${route.params.id}/interest-collection`,
      linkKey: "message.liquidation-ongoingpartial-description-link"
    };
  }

  return null;
});

function getLiquidationCause(): string | undefined {
  if (!lease.value?.in_progress) return undefined;
  if ("liquidation" in lease.value.in_progress) {
    return lease.value.in_progress.liquidation.cause;
  }
  return undefined;
}

function getProtocolIcon() {
  if (!lease.value?.protocol) return null;
  return configStore.getNetworkIconByProtocol(lease.value.protocol);
}

provide("reload", reload);
provide("displayData", displayData);
</script>
