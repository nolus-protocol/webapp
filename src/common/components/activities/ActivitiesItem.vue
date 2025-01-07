<template>
  <div class="flex cursor-pointer gap-3 p-4 hover:bg-neutral-bg-3">
    <SvgIcon
      :name="type"
      size="l"
    />
    <div class="flex flex-col gap-2">
      <div class="flex flex-col">
        <span class="text-16 font-semibold text-typography-default">{{ title }}</span>
        <span class="text-xs font-normal text-typography-secondary">{{ time }}</span>
      </div>
      <div
        class="flex items-center gap-1"
        v-if="route"
      >
        Route:
        <Stepper
          v-if="route"
          :variant="StepperVariant.SMALL"
          v-bind="route"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { type SmallStepperProps, Stepper, StepperVariant, SvgIcon } from "web-components";

export type ActivityItemProps = {
  type: "leases" | "earn" | "assets";
  title: string;
  time?: string;
  route?: SmallStepperProps;
};

defineProps<ActivityItemProps>();
</script>

<style scoped lang=""></style>
