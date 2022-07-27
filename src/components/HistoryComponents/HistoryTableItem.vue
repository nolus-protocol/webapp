<template>
  <div class="md:grid md:grid-cols-12 pt-3 gap-6 border-b border-standart pb-3 px-6 md:flex items-center">
    <div class="hidden col-span-2 lg:block nls-14 nls-font-400 text-primary text-left">
      {{ truncateString(transaction.id) }}
    </div>
    <div class="hidden col-span-2 md:block text-left">
      <span class="inline-block py-1 px-2 text-patch nls-font-500 nls-12 text-primary radius-pill">
        {{ capitalize(transaction.action) }}
      </span>
    </div>
    <div class="block col-span-4 nls-14 nls-font-400 text-primary text-left">
      <span class="nls-12 nls-font-700">
        {{ truncateString(transaction.sender) }}
        {{ $t('message.to') }}
        {{ truncateString(transaction.receiver) }}
      </span>
      <!--                    <span class="text-bold">Stake</span> 797020...qtcrpy to <span-->
      <!--                    class="text-bold">Pylon Governance</span>-->
    </div>
    <div class="block col-span-2 items-center justify-start md:justify-endtext-primary">
      <span class="left-and-right nls-14 nls-font-400">{{
          convertFeeAmount(transaction.fee)
      }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Coin } from '@cosmjs/proto-signing'
import { CurrencyUtils } from '@nolus/nolusjs'

import { StringUtils } from '@/utils/StringUtils'
import { ITransaction } from '@/views/HistoryView.vue'

interface Props {
  transaction: ITransaction;
}

defineProps<Props>()

const truncateString = (text: string) => {
  return StringUtils.truncateString(text, 10, 6)
}

const capitalize = (value: string) => {
  return StringUtils.capitalize(value)
}

const convertFeeAmount = (fee: Coin[] | null) => {
  if (fee === null) {
    return '0'
  }

  const convertFee = CurrencyUtils.convertCosmosCoinToKeplCoin(fee[0])
  const feeAmount = CurrencyUtils.convertCoinUNolusToNolus(convertFee)
  return feeAmount?.toString()
}

</script>
