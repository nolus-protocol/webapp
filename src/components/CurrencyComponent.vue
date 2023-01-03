<template>
  <template v-if="type == CURRENCY_VIEW_TYPES.CURRENCY">
    <span :class="[`text-${fontSize}`, $attrs.class]">
      <template v-if="isDenomInfront">{{ amount.denom }}<template v-if="hasSpace">&nbsp;</template></template>{{ amount.beforeDecimal }}
    </span>
    <span :class="[`text-${smallFontSize}`, $attrs.class]">{{ amount.afterDecimal }}<template v-if="!isDenomInfront" ><template v-if="hasSpace">&nbsp;</template>{{ amount.denom }}</template> </span>
  </template>
  <template v-if="type == CURRENCY_VIEW_TYPES.TOKEN">
    <span :class="[`text-${fontSize}`, $attrs.class]">{{ amount.beforeDecimal }}</span>
    <span :class="[`text-${smallFontSize}`, $attrs.class]">{{ amount.afterDecimal }}<template v-if="hasSpace">&nbsp;</template>{{ amount.denom }}</span>
  </template>
</template>

<script setup lang="ts">
import { DEFAULT_CURRENCY } from '@/config/env';
import { CURRENCY_VIEW_TYPES } from '@/types/CurrencyViewType';
import { CurrencyUtils } from '@nolus/nolusjs';
import { computed } from '@vue/reactivity';

const props = defineProps({
  type: {
    type: String,
    required: true
  },
  amount: {
    type: String,
    required: true
  },
  minimalDenom: {
    type: String,
  },
  denom: {
    type: String,
    required: true
  },
  decimals: {
    type: Number
  },
  maxDecimals: {
    type: Number,
    default: 0
  },
  fontSize: {
    type: Number,
    default: 16
  },
  hasSpace: {
    type: Boolean,
    default: true
  },
  isDenomInfront: {
    type: Boolean,
    default: true
  }
});

const smallFontSize = computed(() => {
  return props.fontSize - 2;
})

const amount = computed(() => {
  switch (props.type) {
    case (CURRENCY_VIEW_TYPES.CURRENCY): {

      let numberAmount = Number(props.amount);

      let amount = new Intl.NumberFormat(DEFAULT_CURRENCY.locale, {
        minimumFractionDigits: DEFAULT_CURRENCY.minimumFractionDigits,
        maximumFractionDigits: DEFAULT_CURRENCY.maximumFractionDigits
      }).format(numberAmount);

      let [beforeDecimal, afterDecimal] = amount.split('.');

      if(numberAmount == 0){
        afterDecimal = '';
      }

      if(afterDecimal?.length > 0){
        afterDecimal = `.${afterDecimal}`;
      }

      return {
        denom: props.denom,
        beforeDecimal,
        afterDecimal
      }
    }
    case (CURRENCY_VIEW_TYPES.TOKEN): {
      const token = CurrencyUtils.convertMinimalDenomToDenom(
        props.amount as string,
        props.minimalDenom as string,
        props.denom as string,
        props.decimals as number
      );
      const denom = token.denom;
      const amount = token.hideDenom(true).toString();
      let [beforeDecimal, afterDecimal] = amount.split('.');

      if(props.maxDecimals > 0 && afterDecimal.length > props.maxDecimals){
        const pow = 10 ** props.maxDecimals;
        const after = Number(`0.${afterDecimal}`);
        const decimals = (Math.round(after * pow) / pow).toString() ;

        let [_, afterParsed] = decimals.split('.');
        
        if(afterParsed == null){
          afterParsed = '0'.repeat(props.maxDecimals);
        }

        afterDecimal = afterParsed;
      }

      if(afterDecimal?.length > 0){
        afterDecimal = `.${afterDecimal}`;
      }

      return {
        denom,
        beforeDecimal,
        afterDecimal
      }
    }
  }
  return {
    denom: '',
    beforeDecimal: '0',
    afterDecimal: ''
  };
});
</script>
<style scoped lang="scss">
span{
  &.text-40{
    font-size: 40px;
  }
  &.text-38{
    font-size: 34px;
  }
}
@media (max-width:576px) {
  span{
    &.text-40{
    font-size: 32px;
  }
  &.text-38{
    font-size: 28px;
  }
  }
}
</style>