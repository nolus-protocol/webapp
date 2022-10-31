<template>
  <div
    class="md:grid md:grid-cols-12 pt-3 gap-6 border-b border-standart pb-3 px-6 md:flex items-center"
  >
    <div
      class="hidden col-span-2 lg:block nls-14 nls-font-400 text-primary text-left"
    >
    <a class="his-url" v-bind:href="applicaton.network.networkAddresses.exploler+'tx/'+ transaction.id" target="_blank">{{ truncateString(transaction.id) }} </a> 
    <img src="@/assets/icons/urlicon.svg" class="float-right w-3 mt-1 his-img">
    </div>
    <div class="hidden col-span-2 md:block text-left">
      <span
        class="inline-block py-1 px-2 text-patch nls-font-500 nls-12 text-primary radius-pill"
      >
        {{ capitalize(transaction.action) }}
      </span>
    </div>
    <div class="block col-span-4 nls-14 nls-font-400 text-primary text-left">
      <span class="nls-12 nls-font-700">
        {{ truncateString(transaction.sender) }}
        {{ $t("message.to") }}
        {{ truncateString(transaction.receiver) }}
      </span>
      <!--                    <span class="text-bold">Stake</span> 797020...qtcrpy to <span-->
      <!--                    class="text-bold">Pylon Governance</span>-->
    </div>
    <div
      class="block col-span-2 items-center justify-start md:justify-endtext-primary"
    >
      <span class="left-and-right nls-14 nls-font-400 his-gray">
        {{ convertFeeAmount(transaction.fee) }}
      </span>
    </div>
    <div
      class="block col-span-2 items-center justify-start md:justify-endtext-primary"
    >
      <span class="left-and-right nls-14 nls-font-400 his-gray">
        {{ transaction.height }}
      </span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { Coin } from '@cosmjs/proto-signing';
import type { ITransaction } from '@/views/HistoryView.vue';

import { useApplicationStore } from '@/stores/application';

import { CurrencyUtils } from '@nolus/nolusjs';
import { StringUtils } from '@/utils/StringUtils';

const applicaton = useApplicationStore();

interface Props {
  transaction: ITransaction;
}
defineProps<Props>();

const truncateString = (text: string) => {
  return StringUtils.truncateString(text, 6, 6);
};

const capitalize = (value: string) => {
  return StringUtils.capitalize(value);
};

const convertFeeAmount = (fee: Coin[] | null) => {
  if (fee === null) {
    return '0';
  }

  const convertFee = CurrencyUtils.convertCosmosCoinToKeplCoin(fee[0]);
  const feeAmount = CurrencyUtils.convertCoinUNolusToNolus(convertFee);
  return feeAmount?.toString();
};
</script>
<style scoped>
.his-url{
  color: #2868E1;
}
.his-gray{
  color: #8396B1;
}
.his-img{
  position: absolute;
  display: inline;
  margin-left: 5px;
}
</style>