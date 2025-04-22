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
        <span
          v-if="amount?.additional"
          :class="amount?.additional?.class"
          class="flex font-semibold text-typography-default"
        >
          {{ amount.additional.text }}
        </span>
      </template>
      <div
        v-else
        class="skeleton-box rounded-[4px]"
        :style="[{ width: loadingWidth ?? '100%', height: `${amount?.fontSize || 32 * 1.2}px` }]"
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
            class="!w-[20px]"
            v-if="pnlStatus?.badge"
            v-bind="pnlStatus?.badge"
          />
          {{ pnlStatus?.value }}
        </div>
      </template>
      <div
        v-else
        class="skeleton-box mt-1 rounded-[4px]"
        :style="[{ width: loadingWidth ?? '100%', height: `${14 * 1.2}px` }]"
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
        <span
          v-if="amount?.additional"
          :class="amount?.additional?.class"
          class="flex font-semibold text-typography-default"
        >
          {{ amount.additional.text }}
        </span>
      </template>
      <div
        v-else
        class="skeleton-box mt-1 rounded-[4px]"
        :style="[{ width: loadingWidth ?? '100%', height: `${secondary?.fontSize || 12 * 1.2}px` }]"
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
  loadingWidth?: string;
}
defineProps<IBigNumber>();
</script>
