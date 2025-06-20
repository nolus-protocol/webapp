<template>
  <SingleLeaseHeader
    :lease="lease"
    :loading="
      status == TEMPLATES.opening ||
      loadingPartialClose ||
      loadingFullClose ||
      loadingOngoingPartialLiquidation ||
      loadingFullPartialLiquidation ||
      loadingOngoingPartialLiquidationLiability ||
      loadingOngoingFullLiquidationLiability
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
      v-if="loadingPartialClose"
      :title="$t('message.closing-partial-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.closing-partial-description") }}
        </p>
      </template>
    </Alert>

    <Alert
      v-if="loadingFullClose"
      :title="$t('message.closing-full-title')"
      :type="AlertType.info"
    >
      <template v-slot:content>
        <p class="my-1 text-14 font-normal text-typography-secondary">
          {{ $t("message.closing-full-description") }}
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

    <PriceWidget :lease="lease" />
    <PositionSummaryWidget
      :lease="lease"
      :loading="
        loadingPartialClose ||
        loadingFullClose ||
        loadingOngoingPartialLiquidation ||
        loadingFullPartialLiquidation ||
        loadingOngoingPartialLiquidationLiability ||
        loadingOngoingFullLiquidationLiability
      "
    />
    <div class="flex flex-col gap-8 md:flex-row">
      <PositionHealthWidget
        :lease="lease"
        :loading="
          status == TEMPLATES.opening ||
          loadingPartialClose ||
          loadingFullClose ||
          loadingOngoingPartialLiquidation ||
          loadingFullPartialLiquidation ||
          loadingOngoingPartialLiquidationLiability ||
          loadingOngoingFullLiquidationLiability
        "
      />
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
import { useRoute, useRouter } from "vue-router";
import { useLease } from "@/common/composables";
import { Logger } from "@/common/utils";
import { computed, onMounted, onUnmounted, provide } from "vue";
import { Alert, AlertType, Stepper, StepperVariant } from "web-components";
import { getStatus, TEMPLATES } from "./common";
import type { LeaseData } from "@/common/types";
import { Contracts, NATIVE_NETWORK, UPDATE_LEASES } from "@/config/global";
import type {
  BuyAssetOngoingState,
  CloseOngoingState,
  LiquidationOngoingState,
  TransferOutOngoingState
} from "@nolus/nolusjs/build/contracts";
import { RouteNames } from "@/router";
import type { OpenedOngoingState } from "@nolus/nolusjs/build/contracts/types/OpenedOngoingState";

const route = useRoute();
const OPENING_CHANNEL = "open_ica_account";
const router = useRouter();

let timeOut: NodeJS.Timeout;

function reload() {
  getLease();
}

const { lease, getLease } = useLease(route.params.id as string, route.params.protocol as string, (error) => {
  Logger.error(error);
});

const steps = computed(() => {
  const protocol = getProtocolIcon()!;

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
    return 2;
  }

  return 3;
});

onMounted(() => {
  timeOut = setInterval(() => {
    getLease();
  }, UPDATE_LEASES);
});

onUnmounted(() => {
  clearInterval(timeOut);
});

const loadingPartialClose = computed(() => {
  const data = (lease.value?.leaseStatus.opened?.status as OpenedOngoingState)?.in_progress as CloseOngoingState;

  if (data?.close?.type == "Partial") {
    return true;
  }

  return false;
});

const loadingFullClose = computed(() => {
  const data = (lease.value?.leaseStatus.opened?.status as OpenedOngoingState)?.in_progress as CloseOngoingState;

  if (data?.close?.type == "Full") {
    return true;
  }

  return false;
});

const loadingRepay = computed(() => {
  const data = lease.value?.leaseStatus.opened?.status as OpenedOngoingState;

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

const loadingOngoingPartialLiquidation = computed(() => {
  const data = (lease.value?.leaseStatus.opened?.status as OpenedOngoingState)?.in_progress as LiquidationOngoingState;
  if (data?.liquidation?.type == "Partial" && data?.liquidation?.cause == "overdue") {
    return true;
  }

  return false;
});

const loadingFullPartialLiquidation = computed(() => {
  const data = (lease.value?.leaseStatus.opened?.status as OpenedOngoingState)?.in_progress as LiquidationOngoingState;

  if (data?.liquidation?.type == "Full" && data?.liquidation?.cause == "overdue") {
    return true;
  }

  return false;
});

const loadingOngoingPartialLiquidationLiability = computed(() => {
  const data = (lease.value?.leaseStatus.opened?.status as OpenedOngoingState)?.in_progress as LiquidationOngoingState;

  if (data?.liquidation?.type == "Partial" && data?.liquidation?.cause == "liability") {
    return true;
  }

  return false;
});

const loadingOngoingFullLiquidationLiability = computed(() => {
  const data = (lease.value?.leaseStatus.opened?.status as OpenedOngoingState)?.in_progress as LiquidationOngoingState;

  if (data?.liquidation?.type == "Full" && data?.liquidation?.cause == "liability") {
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
