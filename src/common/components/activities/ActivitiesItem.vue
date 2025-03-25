<template>
  <div class="flex cursor-pointer gap-3 p-4 hover:bg-neutral-bg-3">
    <div class="relative">
      <SvgIcon
        :name="type"
        size="l"
        class="rounded bg-neutral-bg-4 p-1"
      />
    </div>
    <div class="flex flex-col gap-2">
      <div class="flex flex-col">
        <span class="text-16 font-semibold text-typography-default">{{ title }}</span>
        <span class="text-xs font-normal text-typography-secondary">{{ time }}</span>
      </div>
      <div
        class="flex items-center gap-1 text-xs font-normal text-typography-secondary"
        v-if="route"
      >
        {{ $t("message.route") }}:
        <Stepper
          :variant="StepperVariant.SMALL"
          v-bind="route"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AssetUtils } from "@/common/utils";
import { computed } from "vue";
import { type SmallStepperProps, Stepper, StepperVariant, SvgIcon } from "web-components";

export type ActivityItemProps = {
  type: "leases" | "earn" | "assets" | string;
  title: string;
  time?: string;
  route?: SmallStepperProps;
  coinMinimalDenom?: string;
};

const icon = computed(() => {
  if (props.coinMinimalDenom) {
    const asset = AssetUtils.getCurrencyByDenom(props.coinMinimalDenom);
    return asset.icon;
  }
  return null;
});

const props = defineProps<ActivityItemProps>();
</script>
