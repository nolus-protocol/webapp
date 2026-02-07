<template>
  <div>
    <span
      :class="[`text-${fontSize}`, $attrs.class]"
      class="items-center"
    >
      {{ sign
      }}<template v-if="isDenomPrefix">{{ denom }}<template v-if="hasSpace">&nbsp;</template></template>
      <template v-if="around">~</template>
      <template v-if="animatedReveal && !hide">
        <AnimateNumber
          :value="isMounted ? absValue : 0"
          :format="compact ? compactFormatOptions : currencyFormatOptions(decimals)"
        />
      </template>
      <template v-else-if="hide">****</template>
      <template v-else>
        {{ formatted }}
      </template>
      <template v-if="!isDenomPrefix"><template v-if="hasSpace">&nbsp;</template>{{ denom }}</template>
    </span>
  </div>
</template>

<script lang="ts">
export interface FormattedAmountProps {
  value: string;
  denom: string;
  isDenomPrefix?: boolean;
  decimals?: number;
  fontSize?: number;
  hasSpace?: boolean;
  animatedReveal?: boolean;
  compact?: boolean;
  hide?: boolean;
  around?: boolean;
  tooltip?: boolean;
}
</script>

<script lang="ts" setup>
import { computed, ref, onMounted } from "vue";
import { NATIVE_CURRENCY } from "@/config/global";
import { AnimateNumber } from "motion-plus-vue";
import {
  formatNumber,
  formatCompact,
  currencyFormatOptions,
  compactFormatOptions
} from "@/common/utils/NumberFormatUtils";

const props = withDefaults(defineProps<FormattedAmountProps>(), {
  isDenomPrefix: true,
  decimals: 2,
  fontSize: 16,
  hasSpace: false,
  animatedReveal: false,
  compact: false,
  hide: false,
  around: false,
  tooltip: false
});

const isMounted = ref(false);

const numberValue = computed(() => Number(props.value));

const sign = computed(() => (numberValue.value < 0 ? "-" : ""));

const absValue = computed(() => Math.abs(numberValue.value).toString());

const formatted = computed(() => {
  const abs = Math.abs(numberValue.value);
  return props.compact
    ? formatCompact(abs)
    : formatNumber(abs, props.decimals ?? NATIVE_CURRENCY.maximumFractionDigits);
});

onMounted(() => {
  requestAnimationFrame(() => {
    isMounted.value = true;
  });
});
</script>
