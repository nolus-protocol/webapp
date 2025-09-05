<template>
  <Table
    :columns="columns"
    tableClasses="min-w-[500px]"
  >
    <template v-slot:body>
      <!-- <div class="thin-scroll max-h-[600px] overflow-auto pr-2"> -->
      <TableRow
        v-for="(row, index) in assets"
        :key="index"
        :items="row.items"
      />
      <!-- </div> -->
    </template>
  </Table>
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { Table, type TableColumnProps, TableRow, type TableRowItemProps } from "web-components";
import { computed } from "vue";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";
import { useOracleStore } from "@/common/stores/oracle";
import { AssetUtils } from "@/common/utils";
import { Coin, Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { useWalletStore } from "@/common/stores/wallet";

const i18n = useI18n();
const oracle = useOracleStore();
const wallet = useWalletStore();

const columns: TableColumnProps[] = [
  { label: i18n.t("message.asset"), variant: "left" },
  { label: i18n.t("message.balance"), class: "max-w-[200px]" },
  {
    label: i18n.t("message.release-schedule"),
    class: "md:flex max-w-[200px]",
    tooltip: { content: i18n.t("message.release-schedule-tooltip") }
  }
];

const props = defineProps<{
  vestedTokens: { endTime: string; amount: { amount: string; denom: string } }[];
}>();

const assets = computed(() => {
  const data: TableRowItemProps[] = [];
  const asset = AssetUtils.getCurrencyByTicker(NATIVE_ASSET.ticker);
  const price = oracle.prices[asset.key]?.amount;

  for (const item of props.vestedTokens) {
    const balance = AssetUtils.formatNumber(new Dec(wallet.vestTokens.amount, asset.decimal_digits).toString(3), 3);
    const stable_b = CurrencyUtils.calculateBalance(
      price,
      new Coin(asset.ibcData, wallet.vestTokens.amount),
      asset.decimal_digits
    ).toDec();

    const stable_balance = AssetUtils.formatNumber(stable_b.toString(2), 2);

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
        { value: item.endTime, class: "md:flex max-w-[200px]" }
      ]
    });
  }

  return data;
});
</script>
