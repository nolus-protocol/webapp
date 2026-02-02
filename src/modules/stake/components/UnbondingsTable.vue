<template>
  <Table
    v-if="unboundingDelegations?.length > 0"
    :columns="columns"
  >
    <template v-slot:body>
      <div class="thin-scroll max-h-[600px] overflow-auto pr-2">
        <TableRow
          v-for="(row, index) in assets"
          :key="index"
          :items="row.items"
        />
      </div>
    </template>
  </Table>
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { Table, type TableColumnProps, TableRow, type TableRowItemProps } from "web-components";
import type { IObjectKeys } from "@/common/types";
import { computed } from "vue";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";
import { usePricesStore } from "@/common/stores/prices";
import { datePraser } from "@/common/utils";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { getCurrencyByTicker } from "@/common/utils/CurrencyLookup";
import { Coin, Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";

const i18n = useI18n();
const pricesStore = usePricesStore();

const columns = computed<TableColumnProps[]>(() => [
  { label: i18n.t("message.asset"), variant: "left" },
  { label: i18n.t("message.amount-undelegate"), class: "max-w-[200px]" },
  { label: i18n.t("message.time-left"), class: "hidden md:flex max-w-[120px]" }
]);

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
      const balance = formatNumber(new Dec(item.balance, asset.decimal_digits).toString(3), 3);

      const stable_b = CurrencyUtils.calculateBalance(
        price,
        new Coin(asset.ibcData, item.balance.toString()),
        asset.decimal_digits
      ).toDec();

      const stable_balance = formatNumber(stable_b.toString(2), 2);

      data.push({
        items: [
          {
            value: asset.name,
            subValue: asset.shortName,
            image: asset.icon,
            variant: "left"
          },
          {
            value: `${balance}`,
            subValue: `${NATIVE_CURRENCY.symbol}${stable_balance}`,
            variant: "right",
            class: " max-w-[200px]"
          },
          { value: datePraser(item.completion_time, true), class: "hidden md:flex max-w-[120px]" }
        ]
      });
    }
  }

  return data;
});
</script>
