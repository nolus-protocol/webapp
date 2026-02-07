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
          <TokenAmount
            v-if="amount && isTokenAmount(amount)"
            :font-size="32"
            v-bind="amount"
            class="flex break-keep font-semibold text-typography-default"
          />
          <FormattedAmount
            v-else-if="amount"
            :font-size="32"
            v-bind="amount"
            class="flex break-keep font-semibold text-typography-default"
          />
        </Tooltip>
        <template v-else>
          <TokenAmount
            v-if="amount && isTokenAmount(amount)"
            :font-size="32"
            v-bind="amount"
            class="flex break-keep font-semibold text-typography-default"
          />
          <FormattedAmount
            v-else-if="amount"
            :font-size="32"
            v-bind="amount"
            class="flex break-keep font-semibold text-typography-default"
          />
        </template>
        <span
          v-if="additional"
          :class="additional?.class"
          class="flex break-keep font-semibold text-typography-default"
        >
          {{ additional.text }}
        </span>
      </template>
      <div
        v-else
        class="skeleton-box rounded-[4px]"
        :style="[{ width: loadingWidth ?? '100%', height: `${amountFontSize * 1.2}px` }]"
      ></div>
    </div>

    <template v-if="pnlStatus">
      <template v-if="!loading">
        <div
          v-if="pnlStatus"
          :class="pnlStatus?.positive ? 'text-typography-success' : 'text-typography-error'"
          class="flex items-center gap-1 text-14 font-normal"
        >
          <div
            v-if="pnlStatus?.badge && !pnlStatus.badge.base"
            class="flex w-[20px] items-center justify-center rounded p-0.5"
            :class="pnlStatus.positive ? '!bg-success-muted' : '!bg-error-muted'"
          >
            <SvgIcon
              name="arrow"
              size="xs"
              :class="pnlStatus.positive ? 'fill-icon-success' : 'rotate-180 fill-icon-error'"
            />
          </div>
          <Badge
            v-else-if="pnlStatus?.badge"
            class="!w-[20px]"
            v-bind="pnlStatus.badge"
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
        <TokenAmount
          v-if="isTokenAmount(secondary)"
          v-bind="secondary"
          :font-size="12"
          class="flex font-normal text-typography-default"
        />
        <FormattedAmount
          v-else
          v-bind="secondary"
          :font-size="12"
          class="flex font-normal text-typography-default"
        />
      </template>
      <div
        v-else
        class="skeleton-box mt-1 rounded-[4px]"
        :style="[{ width: loadingWidth ?? '100%', height: `${(secondary?.fontSize ?? 12) * 1.2}px` }]"
      ></div>
    </template>
  </div>
</template>

<script lang="ts">
import type { TokenAmountProps } from "@/common/components/TokenAmount.vue";
import type { FormattedAmountProps } from "@/common/components/FormattedAmount.vue";
import type { TooltipProps } from "web-components";
import type { IBadgeProps } from "web-components/dist/src/components/atoms/badge/types";
import type { Component } from "vue";

export type AmountDisplayProps = TokenAmountProps | FormattedAmountProps;

export function isTokenAmount(props: AmountDisplayProps): props is TokenAmountProps {
  return "microAmount" in props;
}

export interface IBigNumber {
  label?: string;
  labelTooltip?: TooltipProps;
  amount?: AmountDisplayProps & Component;
  secondary?: AmountDisplayProps & Component;
  additional?: {
    text: string;
    class: string;
  };
  pnlStatus?: {
    positive?: boolean;
    badge?: IBadgeProps & Component;
    value?: string;
  };
  loading?: boolean;
  loadingWidth?: string;
}
</script>

<script lang="ts" setup>
import { Badge, SvgIcon, Tooltip } from "web-components";
import TokenAmount from "@/common/components/TokenAmount.vue";
import FormattedAmount from "@/common/components/FormattedAmount.vue";
import { computed } from "vue";
import { formatNumber } from "../utils/NumberFormatUtils";
import { Dec } from "@keplr-wallet/unit";

const props = defineProps<IBigNumber>();

const amountFontSize = computed(() => {
  return props.amount?.fontSize ?? 32;
});

const amount_tooltip = computed(() => {
  if (props.amount?.tooltip) {
    if (isTokenAmount(props.amount)) {
      const a = new Dec(props.amount.microAmount, props.amount.decimals);
      return `~${formatNumber(a.toString(props.amount.decimals), props.amount.decimals)}`;
    } else {
      return `~${props.amount.value}`;
    }
  }
  return "";
});
</script>
