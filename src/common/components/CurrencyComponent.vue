<template>
  <div>
    <template v-if="type == CURRENCY_VIEW_TYPES.CURRENCY">
      <span
        :class="[`text-${fontSize}`, $attrs.class]"
        class="items-center"
      >
        {{ amount.symbol
        }}<template v-if="isDenomInfront"> {{ amount.denom }}<template v-if="hasSpace">&nbsp;</template> </template>
        <template v-if="around">~</template>
        <template v-if="animatedReveal && !hide">
          <AnimateNumber
            :value="isMounted ? numberAmount : 0"
            :format="compact ? compactFormatOptions : currencyFormatOptions(maxDecimals)"
          />
        </template>
        <template v-else>
          {{ amount.formatted }}
        </template>
        <template v-if="!isDenomInfront"> <template v-if="hasSpace">&nbsp;</template>{{ amount.denom }}</template>
      </span>
    </template>
    <template v-if="type == CURRENCY_VIEW_TYPES.TOKEN">
      <span
        :class="[`text-${fontSize}`, $attrs.class]"
        class="items-center"
      >
        <template v-if="around">~</template>
        <template v-if="animatedReveal && !hide">
          <AnimateNumber
            :value="isMounted ? numberAmount : 0"
            :format="compact ? compactFormatOptions : tokenFormatOptions(tokenMaxDecimals)"
          />
        </template>
        <template v-else>
          {{ amount.formatted }}
        </template>
        <template v-if="hasSpace">&nbsp;</template>{{ amount.denom }}
      </span>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, onMounted } from "vue";
import { NATIVE_CURRENCY } from "@/config/global";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { AnimateNumber } from "motion-plus-vue";
import { Dec } from "@keplr-wallet/unit";
import {
  formatNumber,
  formatCompact,
  formatToken,
  currencyFormatOptions,
  tokenFormatOptions,
  compactFormatOptions,
  getDecimals
} from "@/common/utils/NumberFormatUtils";

export interface CurrencyComponentProps {
  type: string;
  amount: string;
  minimalDenom?: string;
  denom: string;
  decimals?: number;
  maxDecimals?: number;
  fontSize?: number;
  hasSpace?: boolean;
  isDenomInfront?: boolean;
  defaultZeroValue?: string;
  around?: boolean;
  hide?: boolean;
  tooltip?: boolean;
  animatedReveal?: boolean;
  compact?: boolean;
  additional?: {
    text: string;
    class: string;
  };
}

const props = withDefaults(defineProps<CurrencyComponentProps>(), {
  denom: "",
  maxDecimals: 2,
  decimals: 2,
  fontSize: 16,
  hasSpace: false,
  isDenomInfront: true,
  animatedReveal: false,
  compact: false
});

const isMounted = ref(false);

const numberAmount = computed(() => {
  return new Dec(props.amount, props.decimals).abs().toString(props.decimals);
});

const tokenMaxDecimals = computed(() => {
  if (props.type !== CURRENCY_VIEW_TYPES.TOKEN) return props.maxDecimals;
  const dec = new Dec(props.amount, props.decimals).abs();
  return getDecimals(dec);
});

const amount = computed(() => {
  switch (props.type) {
    case CURRENCY_VIEW_TYPES.CURRENCY: {
      const numberAmount = Number(props.amount);

      if (props.hide) {
        return { symbol: "", denom: "", formatted: "****" };
      }

      if (numberAmount == 0 && props.defaultZeroValue) {
        return { denom: props.defaultZeroValue, formatted: "" };
      }

      const symbol = numberAmount < 0 ? "-" : "";
      const formatted = props.compact
        ? formatCompact(Math.abs(numberAmount))
        : formatNumber(Math.abs(numberAmount), props.decimals ?? NATIVE_CURRENCY.maximumFractionDigits);

      return { symbol, denom: props.denom, formatted };
    }
    case CURRENCY_VIEW_TYPES.TOKEN: {
      if (props.hide) {
        return { denom: "", formatted: "****" };
      }

      const dec = new Dec(props.amount, props.decimals).abs();
      const numValue = Number(dec.toString(props.decimals));

      const formatted = props.compact
        ? formatCompact(numValue)
        : formatToken(numValue, tokenMaxDecimals.value);

      return { denom: props.denom, formatted };
    }
  }
  return { denom: "", formatted: "0" };
});

onMounted(() => {
  requestAnimationFrame(() => {
    isMounted.value = true;
  });
});
</script>
<style>
.number-section-fraction,
.number-section-integer {
  align-items: flex-end !important;
}
</style>
