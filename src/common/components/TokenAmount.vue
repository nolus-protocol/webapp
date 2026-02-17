<template>
  <div>
    <span
      :class="[`text-${fontSize}`, $attrs.class]"
      class="items-center"
    >
      <template v-if="hide">****</template>
      <template v-else>
        <template v-if="around">~</template>
        <template v-if="animatedReveal">
          <AnimateNumber
            :value="isMounted ? numberAmount : 0"
            :format="useCompact ? compactFormatOptions : tokenFormatOptions(adaptiveDecimals)"
          />
        </template>
        <template v-else>
          {{ formatted }}
        </template>
        &nbsp;{{ denom }}
      </template>
    </span>
  </div>
</template>

<script lang="ts">
export interface TokenAmountProps {
  microAmount: string;
  decimals: number;
  denom: string;
  fontSize?: number;
  animatedReveal?: boolean;
  compact?: boolean;
  hide?: boolean;
  around?: boolean;
  tooltip?: boolean;
}
</script>

<script lang="ts" setup>
import { computed, ref, onMounted } from "vue";
import { Dec } from "@keplr-wallet/unit";
import { AnimateNumber } from "motion-plus-vue";
import {
  formatToken,
  formatCompact,
  tokenFormatOptions,
  compactFormatOptions,
  getDecimals
} from "@/common/utils/NumberFormatUtils";

const props = withDefaults(defineProps<TokenAmountProps>(), {
  fontSize: 16,
  animatedReveal: false,
  compact: false,
  hide: false,
  around: false,
  tooltip: false
});

const isMounted = ref(false);

const dec = computed(() => new Dec(props.microAmount, props.decimals).abs());

const numberAmount = computed(() => dec.value.toString(props.decimals));

const adaptiveDecimals = computed(() => getDecimals(dec.value));

// Only use compact formatting for large values; small values need full precision
const useCompact = computed(() => props.compact && dec.value.gte(new Dec(1000)));

const formatted = computed(() => {
  const numValue = Number(dec.value.toString(props.decimals));
  return useCompact.value ? formatCompact(numValue) : formatToken(numValue, adaptiveDecimals.value);
});

onMounted(() => {
  requestAnimationFrame(() => {
    isMounted.value = true;
  });
});
</script>
