<template>
  <Widget class="h-fit">
    <WidgetHeader
      :label="$t('message.earning-rewards')"
      :icon="{ name: 'list-sparkle' }"
    >
      <Button
        label="Claim rewards"
        severity="secondary"
        size="large"
      />
    </WidgetHeader>
    <div class="flex flex-col gap-y-2">
      <BigNumber
        :label="$t('message.unclaimed-rewards')"
        :amount="{
          amount: stableRewards,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol
        }"
      />
    </div>

    <Asset
      v-for="(item, index) in rewards"
      :key="index"
      :icon="item.icon"
      :amount="item.amount"
      :stable-amount="item.stableAmount"
    />
  </Widget>
</template>

<script lang="ts" setup>
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import { Button, Widget, Asset } from "web-components";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { NATIVE_CURRENCY } from "@/config/global";

defineProps<{
  rewards: {
    amount: string;
    stableAmount: string;
    icon: string;
  }[];
  stableRewards: string;
}>();
</script>
