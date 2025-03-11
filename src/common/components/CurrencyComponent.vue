<template>
  <div>
    <template v-if="type == CURRENCY_VIEW_TYPES.CURRENCY">
      <span :class="[`text-${fontSize}`, $attrs.class]">
        {{ amount.symbol
        }}<template v-if="isDenomInfront">{{ amount.denom }}<template v-if="hasSpace">&nbsp;</template></template
        ><template v-if="around">~</template>{{ amount.beforeDecimal }}
      </span>
      <span :class="[`text-${smallFontSize}`, $attrs.class]"
        >{{ amount.afterDecimal
        }}<template v-if="!isDenomInfront"><template v-if="hasSpace">&nbsp;</template>{{ amount.denom }}</template>
      </span>
    </template>
    <template v-if="type == CURRENCY_VIEW_TYPES.TOKEN">
      <span :class="[`text-${fontSize}`, $attrs.class]"
        ><template v-if="around">~</template>{{ amount.beforeDecimal }}</span
      >
      <span :class="[`text-${smallFontSize}`, $attrs.class]"
        >{{ amount.afterDecimal }}<template v-if="hasSpace">&nbsp;</template>{{ amount.denom }}</span
      >
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { NATIVE_CURRENCY } from "@/config/global";
import { CURRENCY_VIEW_TYPES } from "@/common/types";

export interface CurrencyComponentProps {
  type: string;
  amount: string;
  minimalDenom?: string;
  denom: string;
  decimals?: number;
  maxDecimals?: number;
  fontSize?: number;
  fontSizeSmall?: number;
  hasSpace?: boolean;
  isDenomInfront?: boolean;
  defaultZeroValue?: string;
  prettyZeros?: boolean;
  around?: boolean;
  hide?: boolean;
}

const props = withDefaults(defineProps<CurrencyComponentProps>(), {
  maxDecimals: 0,
  fontSize: 16,
  SmallFontSize: 16,
  hasSpace: false,
  isDenomInfront: true,
  prettyZeros: false
});

const smallFontSize = computed(() => {
  if (props.fontSizeSmall) {
    return props.fontSizeSmall;
  }
  return props.fontSize - 2;
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

      let amount = new Intl.NumberFormat(NATIVE_CURRENCY.locale, {
        minimumFractionDigits: props.decimals ?? NATIVE_CURRENCY.minimumFractionDigits,
        maximumFractionDigits: props.decimals ?? NATIVE_CURRENCY.maximumFractionDigits
      }).format(Math.abs(numberAmount));

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
      const token = CurrencyUtils.convertMinimalDenomToDenom(
        props.amount as string,
        props.minimalDenom as string,
        props.denom as string,
        props.decimals as number
      );
      let denom = token.denom;
      const amount = token.hideDenom(true).toString();
      let [beforeDecimal, afterDecimal] = amount.split(".");
      if (props.maxDecimals > 0 && afterDecimal?.length > props.maxDecimals) {
        const pow = 10 ** props.maxDecimals;
        const after = Number(`0.${afterDecimal}`);
        const decimals = (Math.round(after * pow) / pow).toString();
        let [_value, afterParsed] = decimals.split(".");

        if (afterParsed == null) {
          afterParsed = "0".repeat(props.maxDecimals);
        }

        afterDecimal = afterParsed;

        if (afterDecimal.length < props.maxDecimals) {
          const d = "0".repeat(props.maxDecimals - afterDecimal.length);
          afterDecimal = `${afterDecimal}${d}`;
        }
      }

      if (afterDecimal?.length > 0) {
        afterDecimal = `.${afterDecimal}`;
      } else {
        afterDecimal = ".00";
      }

      if (props.hide) {
        beforeDecimal = "**";
        afterDecimal = "**";
        denom = "";
      }

      if (props.decimals == 0) {
        afterDecimal = "";
      }
      return {
        denom,
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
</script>
<style lang="scss" scoped></style>
