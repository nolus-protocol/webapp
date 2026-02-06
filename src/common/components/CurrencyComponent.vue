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
          {{ amount.beforeDecimal + amount.afterDecimal }}
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
            :format="tokenFormatOptions(tokenMaxDecimals)"
          />
        </template>
        <template v-else>
          {{ amount.beforeDecimal + amount.afterDecimal }}
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
  prettyZeros?: boolean;
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
  prettyZeros: false,
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
      let numberAmount = Number(props.amount);
      let symbol = "";

      if (numberAmount < 0) {
        symbol = "-";
      }

      if (numberAmount == 0 && props.defaultZeroValue) {
        return {
          denom: props.defaultZeroValue,
          beforeDecimal: "",
          afterDecimal: ""
        };
      }

      if (props.compact) {
        const formatted = formatCompact(Math.abs(numberAmount));

        if (props.hide) {
          return { symbol: "", denom: "", beforeDecimal: "**", afterDecimal: "**" };
        }

        return {
          symbol,
          denom: props.hide ? "" : props.denom,
          beforeDecimal: formatted,
          afterDecimal: ""
        };
      }

      let amount = formatNumber(Math.abs(numberAmount), props.decimals ?? NATIVE_CURRENCY.maximumFractionDigits);

      let [beforeDecimal, afterDecimal] = amount.split(".");

      if (numberAmount == 0 && !props.prettyZeros) {
        afterDecimal = "";
      }

      if (afterDecimal?.length > 0) {
        afterDecimal = `.${afterDecimal}`;
      } else {
        afterDecimal = ".00";
      }

      if (props.hide) {
        beforeDecimal = "**";
        afterDecimal = "**";
        symbol = "";
      }

      if (props.decimals == 0) {
        afterDecimal = "";
      }

      return {
        symbol,
        denom: props.hide ? "" : props.denom,
        beforeDecimal,
        afterDecimal
      };
    }
    case CURRENCY_VIEW_TYPES.TOKEN: {
      const dec = new Dec(props.amount, props.decimals).abs();
      const numValue = Number(dec.toString(props.decimals));
      const maxDec = tokenMaxDecimals.value;
      const formatted = new Intl.NumberFormat(NATIVE_CURRENCY.locale, tokenFormatOptions(maxDec)).format(numValue);
      let [beforeDecimal, afterDecimal] = formatted.split(".");

      afterDecimal = afterDecimal ? `.${afterDecimal}` : ".00";

      if (props.hide) {
        return { denom: "", beforeDecimal: "**", afterDecimal: "**" };
      }

      if (props.decimals == 0) {
        afterDecimal = "";
      }

      return {
        denom: props.denom,
        beforeDecimal,
        afterDecimal
      };
    }
  }
  return {
    denom: "",
    beforeDecimal: "0",
    afterDecimal: ""
  };
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
