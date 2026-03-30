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
          <ProgressDots
            :steps="3"
            :activeStep="openingSubState"
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
              v-if="inProgressBanner.onLinkClick"
              @click="inProgressBanner.onLinkClick()"
              class="cursor-pointer font-normal text-typography-link"
            >
              {{ $t(inProgressBanner.linkKey!) }}
            </a>
          </p>
        </template>
      </Alert>

      <PriceWidget
        :lease="lease"
        :display-data="displayData"
      />
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
        <LeaseLogWidget
          v-if="lease?.etl_data"
          :lease="lease"
          class="flex-1"
        />
      </div>
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
import { IntercomService, Logger } from "@/common/utils";
import { computed, onMounted, onUnmounted, provide, ref, watch, watchEffect } from "vue";
import { Alert, AlertType } from "web-components";
import ProgressDots from "@/common/components/ProgressDots.vue";
import { TEMPLATES } from "./common";
import { UPDATE_LEASES } from "@/config/global";
import { RouteNames } from "@/router";
import { useLeasesStore, type LeaseDisplayData } from "@/common/stores/leases";
import { useBalancesStore } from "@/common/stores/balances";
import type { LeaseInfo } from "@/common/api";

const route = useRoute();
const router = useRouter();
const leasesStore = useLeasesStore();
const balancesStore = useBalancesStore();

let timeOut: NodeJS.Timeout;

// Lease state — single source of truth is the store. All updates (HTTP poll,
// WebSocket) flow through the store; this ref is kept in sync reactively.
// Once data exists, it never reverts to null — prevents content blink.
const lease = ref<LeaseInfo | null>(null);
const leaseAddress = computed(() => route.params.id as string);

watchEffect(() => {
  const storeLease = leasesStore.getLease(leaseAddress.value);
  if (storeLease) {
    lease.value = storeLease;
  }
});

const protocol = computed(() => lease.value?.protocol ?? leasesStore.getLease(leaseAddress.value)?.protocol ?? "");

// Computed display data for child components
const displayData = computed<LeaseDisplayData | null>(() => {
  if (!lease.value) return null;
  return leasesStore.getLeaseDisplayData(lease.value);
});

// Fetches lease data into the store. Does NOT touch lease.value directly —
// the watchEffect above picks up store changes reactively.
async function fetchLease() {
  try {
    // We must know the protocol before fetching — the backend defaults to a
    // Long protocol when none is supplied, which produces wrong data for Shorts.
    let proto = protocol.value;
    if (!proto) {
      // Protocol unknown (direct URL navigation). Fetch the full lease list
      // so the store discovers which protocol this lease belongs to.
      await leasesStore.fetchLeases();
      proto = leasesStore.getLease(leaseAddress.value)?.protocol ?? "";
    }
    if (!proto) return; // still unknown — don't fetch with wrong default

    await leasesStore.fetchLeaseDetails(leaseAddress.value, proto);
  } catch (error) {
    Logger.error(error);
  }
}

function reload() {
  fetchLease();
  balancesStore.fetchBalances();
}

const status = computed(() => {
  if (!lease.value) return TEMPLATES.opening;
  switch (lease.value.status) {
    case "opening":
      return TEMPLATES.opening;
    case "opened":
      return TEMPLATES.opened;
    case "paid_off":
      return TEMPLATES.paid;
    case "closing":
      return TEMPLATES.paid; // closing shows as paid template
    case "closed":
      return TEMPLATES.closed;
    case "liquidated":
      return TEMPLATES.liquidated;
    default:
      return TEMPLATES.opening;
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
  fetchLease();
  timeOut = setInterval(fetchLease, UPDATE_LEASES);
});

onUnmounted(() => {
  clearInterval(timeOut);
});

// On route params change, fetch the new lease into the store.
// The watchEffect handles syncing store → lease.value.
watch(
  () => route.params.id,
  () => fetchLease()
);

// Redirect to positions list when lease reaches a terminal state
watch(
  () => lease.value?.status,
  (newStatus) => {
    if (newStatus === "closed" || newStatus === "liquidated" || newStatus === "paid_off") {
      balancesStore.fetchBalances();
      leasesStore.refresh().then(() => router.replace(`/${RouteNames.LEASES}`));
    }
  }
);

const isInProgress = computed(() => {
  if (lease.value?.status === "closing") return true;
  const type = displayData.value?.inProgressType;
  if (!type) return false;
  return type !== "opening"; // All non-opening in-progress types show loading
});

interface InProgressBanner {
  titleKey: string;
  descriptionKey: string;
  linkKey?: string;
  onLinkClick?: () => void;
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

  if (type === "slippage_protection") {
    return {
      titleKey: "message.slippage-protection-title",
      descriptionKey: "message.slippage-protection-description",
      linkKey: "message.slippage-protection-description-link",
      onLinkClick: () =>
        IntercomService.askQuestion("How does Market Anomaly Guard (MAG) protect my position from unfair liquidation?")
    };
  }

  if (type === "liquidation") {
    const cause = getLiquidationCause();
    if (cause === "liability") {
      return {
        titleKey: "message.liquidation-ongoingpartial-liability-title",
        descriptionKey: "message.liquidation-ongoingpartial-liability-description",
        linkKey: "message.liquidation-ongoingpartial-liability-description-link",
        onLinkClick: () =>
          IntercomService.askQuestion("My position is being partially liquidated due to low health. What should I do?")
      };
    }
    // Default to overdue (interest collection) for any liquidation cause
    return {
      titleKey: "message.liquidation-ongoingpartial-title",
      descriptionKey: "message.liquidation-ongoingpartial-description",
      linkKey: "message.liquidation-ongoingpartial-description-link",
      onLinkClick: () =>
        IntercomService.askQuestion("My position is being liquidated due to overdue interest. What should I do?")
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

provide("reload", reload);
provide("displayData", displayData);
</script>
