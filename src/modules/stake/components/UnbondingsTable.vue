<template>
  <Table
    v-if="unboundingDelegations?.length > 0"
    :columns="columns"
    :scrollable="!mobile"
  >
    <template v-slot:body>
      <TableRow
        v-for="(row, index) in assets"
        :key="index"
        :items="row.items"
        :scrollable="!mobile"
      />
    </template>
  </Table>
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { Table, type TableColumnProps, TableRow, type TableRowItemProps } from "web-components";
import type { IObjectKeys } from "@/common/types";
import { computed } from "vue";
import { NATIVE_ASSET } from "@/config/global";
import { usePricesStore } from "@/common/stores/prices";
import { dateParser, isMobile } from "@/common/utils";
import { formatTokenBalance, formatUsd, formatMobileAmount, formatMobileUsd } from "@/common/utils/NumberFormatUtils";
import { getCurrencyByTicker } from "@/common/utils/CurrencyLookup";
import { Coin, Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";

const i18n = useI18n();
const pricesStore = usePricesStore();
const mobile = isMobile();

const columns = computed<TableColumnProps[]>(() => mobile
  ? [
      { label: i18n.t("message.asset"), variant: "left" },
      { label: i18n.t("message.amount-undelegate") }
    ]
  : [
      { label: i18n.t("message.asset"), variant: "left" },
      { label: i18n.t("message.amount-undelegate"), class: "max-w-[200px]" },
      { label: i18n.t("message.time-left"), class: "max-w-[120px]" }
    ]
);

const props = defineProps<{
  unboundingDelegations: IObjectKeys[];
  showEmpty: boolean;
}>();

const assets = computed(() => {
  const data: TableRowItemProps[] = [];
  const asset = getCurrencyByTicker(NATIVE_ASSET.ticker);
  const price = pricesStore.prices[asset.key]?.price;

  for (const validator of props.unboundingDelegations) {
    for (const item of validator.entries) {
      const amountDec = new Dec(item.balance, asset.decimal_digits);

      const stable_b = CurrencyUtils.calculateBalance(
        price,
        new Coin(asset.ibcData, item.balance.toString()),
        asset.decimal_digits
      ).toDec();

      const balanceLabel = mobile ? formatMobileAmount(amountDec) : formatTokenBalance(amountDec);
      const stableLabel = mobile ? formatMobileUsd(stable_b) : formatUsd(stable_b.toString(2));

      if (mobile) {
        data.push({
          items: [
            {
              value: asset.shortName,
              subValue: dateParser(item.completion_time, true),
              image: asset.icon,
              variant: "left"
            },
            {
              value: balanceLabel,
              subValue: stableLabel
            }
          ]
        });
      } else {
        data.push({
          items: [
            {
              value: asset.name,
              subValue: asset.shortName,
              image: asset.icon,
              variant: "left"
            },
            {
              value: balanceLabel,
              subValue: stableLabel,
              class: "max-w-[200px]"
            },
            { value: dateParser(item.completion_time, true), class: "max-w-[120px]" }
          ]
        });
      }
    }
  }

  return data;
});
</script>
