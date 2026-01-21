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
        <Tooltip
          v-if="amount?.tooltip"
          :content="amount_tooltip"
        >
          <CurrencyComponent
            v-if="amount"
            :font-size="32"
            v-bind="amount"
            class="flex break-keep font-semibold text-typography-default"
          />
        </Tooltip>
        <template v-else>
          <CurrencyComponent
            v-if="amount"
            :font-size="32"
            v-bind="amount"
            class="flex break-keep font-semibold text-typography-default"
          />
        </template>
        <span
          v-if="amount?.additional"
          :class="amount?.additional?.class"
          class="flex break-keep font-semibold text-typography-default"
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
          class="flex font-normal text-typography-default"
        />
        <span
          v-if="amount?.additional"
          :class="amount?.additional?.class"
          class="flex break-keep font-semibold text-typography-default"
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
import { computed, type Component } from "vue";
import { AssetUtils } from "../utils";
import { Dec } from "@keplr-wallet/unit";

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
const props = defineProps<IBigNumber>();

const amount_tooltip = computed(() => {
  if (props.amount?.tooltip) {
    const a = new Dec(props.amount.amount ?? 0, props.amount.decimals ?? 0);
    return `~${AssetUtils.formatNumber(a.toString(props.amount.decimals), props.amount.decimals ?? 0)}`;
  }
  return "";
});
</script>
