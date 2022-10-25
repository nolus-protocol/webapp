<template>
  <template v-if="type == CURRENCY_VIEW_TYPES.CURRENCY">
    <span :class="'text-'+fontSize">
      <template v-if="isDenomInfront">{{ amount.denom }}<template v-if="hasSpace">&nbsp;</template></template>{{ amount.beforeDecimal }}
    </span>
    <span :class="'text-'+smallFontSize">{{ amount.afterDecimal }}<template v-if="!isDenomInfront" ><template v-if="hasSpace">&nbsp;</template>{{ amount.denom }}</template> </span>
  </template>
  <template v-if="type == CURRENCY_VIEW_TYPES.TOKEN">
    <span :class="'text-'+fontSize">{{ amount.beforeDecimal }}</span>
    <span :class="'text-'+smallFontSize">{{ amount.afterDecimal }}<template v-if="hasSpace">&nbsp;</template>{{ amount.denom }}</span>
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
        minimumFractionDigits: DEFAULT_CURRENCY.minimumFractionDigits 
      }).format(Number(props.amount));

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
