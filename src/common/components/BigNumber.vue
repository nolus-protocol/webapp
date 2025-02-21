<template>
  <div class="flex flex-col">
    <div
      v-if="label"
      class="label flex items-center gap-1 text-14 font-normal text-typography-secondary"
    >
      {{ label }}
      <Tooltip
        v-if="labelTooltip"
        :position="labelTooltip.position || 'top'"
        :content="labelTooltip.content"
        ><SvgIcon
          name="help"
          class="rouded-full"
          size="s"
      /></Tooltip>
    </div>
    <div class="flex items-center gap-2">
      <template v-if="!loading">
        <CurrencyComponent
          v-if="amount"
          :font-size="32"
          :font-size-small="32"
          v-bind="amount"
          class="flex font-semibold text-typography-default"
        />
      </template>
      <div
        v-else
        class="skeleton-box"
        :style="[{ width: '100%', height: `${amount?.fontSize || 32 * 1.4}px` }]"
      ></div>
    </div>
    <template v-if="pnlStatus">
      <template v-if="!loading">
        <div
          v-if="pnlStatus"
          :class="pnlStatus?.positive ? 'text-typography-success' : 'text-typography-error'"
          class="flex gap-1 text-14 font-normal"
        >
          <Badge
            v-if="pnlStatus?.badge"
            v-bind="pnlStatus?.badge"
          />
          {{ pnlStatus?.value }}
        </div>
      </template>
      <div
        v-else
        class="skeleton-box"
        :style="[{ width: '100%', height: `${14 * 1.4}px` }]"
      ></div>
    </template>

    <template v-if="secondary">
      <template v-if="!loading">
        <CurrencyComponent
          v-if="secondary"
          v-bind="secondary"
          :amount="secondary?.amount"
          :denom="secondary?.denom"
          :type="secondary?.type"
          :font-size="12"
          :font-size-small="12"
          class="flex font-normal text-typography-default"
        />
      </template>
      <div
        v-else
        class="skeleton-box"
        :style="[{ width: '100%', height: `${secondary?.fontSize || 12 * 1.4}px` }]"
      ></div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { Badge, SvgIcon, Tooltip, type TooltipProps } from "web-components";
import CurrencyComponent, { type CurrencyComponentProps } from "@/common/components/CurrencyComponent.vue";
import type { IBadgeProps } from "web-components/dist/src/components/atoms/badge/types";
import type { Component } from "vue";

export interface IBigNumber {
  label?: string;
  labelTooltip?: TooltipProps;
  description?: string;
  amount?: CurrencyComponentProps & Component;
  secondary?: CurrencyComponentProps & Component;
  pnlStatus?: {
    positive?: boolean;
    badge?: IBadgeProps & Component;
    value?: string;
  };
  icon?: boolean;
  loading?: boolean;
}
const props = defineProps<IBigNumber>();
</script>

<style scoped lang="scss">
.label {
  text-transform: capitalize;
}

.skeleton-box {
  background-color: #ccc;
  animation: blink 1.2s linear infinite;
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
