<template>
  <Widget class="h-fit flex-1"
    ><WidgetHeader
      :label="$t('message.position-health')"
      :icon="{ name: 'heart', class: 'fill-icon-link' }"
    />
    <EmptyState
      v-if="leaseStatus == TEMPLATES.opening"
      :slider="[
        {
          image: { name: 'position-health' },
          title: $t('message.position-health-empty'),
          description: $t('message.position-health-empty-description'),
          link: {
            label: $t('message.position-health-empty-link'),
            url: `/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}/learn-health`,
            tooltip: { content: $t('message.position-health-empty-tooltip') }
          }
        }
      ]"
    />

    <template v-else>
      <div class="relative flex flex-col items-center justify-center">
        <svg
          width="256"
          height="128"
          viewBox="0 0 256 128"
        >
          <path
            :d="arcPath(0, yellowEndAngle)"
            fill="none"
            stroke="#DF294D"
            stroke-width="12"
          />

          <path
            :d="arcPath(yellowEndAngle, greenEndAngle)"
            fill="none"
            stroke="#FFBF34"
            stroke-width="12"
          />

          <!-- Green Arc -->
          <path
            v-if="greenEndAngle > 0"
            :d="arcPath(greenEndAngle, 180)"
            fill="none"
            stroke="#19A96C"
            stroke-width="12"
            stroke-linecap="round"
          />

          <!-- Yellow Arc -->

          <!-- Red Arc -->
        </svg>
        <HealthArrow
          class="absolute bottom-0 left-0 right-0 mx-auto origin-bottom transform"
          :style="[`${rotationStyle}`]"
        />
      </div>
      <div class="flex flex-col items-center text-typography-default">
        <div
          v-if="loading"
          class="skeleton-box mb-2 rounded-[4px]"
          :style="[{ width: '100px', height: `${26 * 1.2}px` }]"
        ></div>
        <div
          v-else
          class="text-40 font-semibold"
        >
          {{ health }}%
        </div>
        <div class="flex text-16">
          {{ $t("message.current-health") }}:
          <div
            v-if="loading"
            class="skeleton-box ml-2 rounded-[4px]"
            :style="[{ width: '60px', height: `${16 * 1.2}px` }]"
          ></div>

          <span
            class="ml-2 font-semibold"
            v-else
          >
            {{ $t(`message.${healTitle}-status`) }}
          </span>
        </div>
        <button
          @click="
            () => {
              router.push(`/${RouteNames.LEASES}/${route.params.protocol}/${route.params.id}/learn-health`);
            }
          "
          target="_blank"
          class="flex w-fit items-center gap-1 text-14 font-normal text-typography-link"
        >
          {{ $t("message.learn-health") }}
        </button>
      </div>
    </template>
  </Widget>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { Widget } from "web-components";

import WidgetHeader from "@/common/components/WidgetHeader.vue";
import HealthArrow from "@/assets/icons/lease/health-arrow.svg";
import EmptyState from "@/common/components/EmptyState.vue";
import { TEMPLATES } from "../common";
import { useRoute, useRouter } from "vue-router";
import { RouteNames } from "@/router";
import type { LeaseInfo } from "@/common/api";
import type { LeaseDisplayData } from "@/common/stores/leases";

const radius = 112;
const centerX = 128;
const centerY = 128;
const route = useRoute();
const router = useRouter();

enum status {
  green = "green",
  yellow = "yellow",
  red = "red"
}

const props = withDefaults(
  defineProps<{
    lease?: LeaseInfo | null;
    displayData?: LeaseDisplayData | null;
    greenLimit?: number;
    yellowLimit?: number;
    loading?: boolean;
  }>(),
  {
    greenLimit: 25,
    yellowLimit: 10
  }
);

const healTitle = computed(() => {
  if (health.value >= props.greenLimit) {
    return status.green;
  }

  if (health.value > props.yellowLimit && health.value < props.greenLimit) {
    return status.yellow;
  }
  if (health.value <= props.yellowLimit) {
    return status.red;
  }
  return status.red;
});

const greenEndAngle = computed(() => (props.greenLimit / 100) * 180);
const yellowEndAngle = computed(() => (props.yellowLimit / 100) * 180);
const rotationStyle = computed(() => {
  const p = health.value;

  const angle = (p / 100) * 180;
  if (angle >= 90) {
    return `rotate: ${angle - 90}deg`;
  }

  return `rotate: -${90 - angle}deg`;
});

const arcPath = (startAngle: number, endAngle: number) => {
  const startX = centerX + radius * Math.cos((180 - startAngle) * (Math.PI / 180));
  const startY = centerY - radius * Math.sin(startAngle * (Math.PI / 180));
  const endX = centerX + radius * Math.cos((180 - endAngle) * (Math.PI / 180));
  const endY = centerY - radius * Math.sin(endAngle * (Math.PI / 180));

  return `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;
};

const health = computed(() => {
  // Use pre-computed health from displayData
  if (props.displayData) {
    return props.displayData.health;
  }
  return 0;
});

const leaseStatus = computed(() => {
  if (!props.lease) return TEMPLATES.opening;
  switch (props.lease.status) {
    case "opening": return TEMPLATES.opening;
    case "opened": return TEMPLATES.opened;
    case "paid_off": return TEMPLATES.paid;
    case "closing": return TEMPLATES.paid;
    case "closed": return TEMPLATES.closed;
    case "liquidated": return TEMPLATES.liquidated;
    default: return TEMPLATES.opening;
  }
});
</script>
