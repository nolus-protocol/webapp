<template>
  <Widget class="overflow-auto"
    ><WidgetHeader
      :label="$t('message.lease-log')"
      :icon="{ name: 'history', class: 'fill-icon-link' }"
    />
    <Table
      v-if="leasesHistory.length > 0"
      :columns="leasesHistory.length > 0 ? columns : []"
      tableClasses="md:min-w-[600px]"
      :scrollable="!mobile"
    >
      <template v-slot:body>
        <TableRow
          v-for="(row, index) in leasesHistory"
          :key="index"
          :items="row.items"
          :scrollable="!mobile"
        />
      </template>
    </Table>
    <EmptyState
      v-else
      :slider="[
        {
          image: { name: 'no-entries', class: 'min-h-[240px]' },
          title: $t('message.no-entries-lease'),
          description: $t('message.no-entries-lease-description')
        }
      ]"
    />
  </Widget>
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import {
  Label,
  type LabelProps,
  Table,
  type TableColumnProps,
  TableRow,
  type TableRowItemProps,
  Widget
} from "web-components";
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import { computed, h } from "vue";
import type { LeaseInfo } from "@/common/api";
import { useConfigStore } from "@/common/stores/config";
import { getCreatedAtForHuman, isMobile } from "@/common/utils";
import { formatTokenBalance, formatMobileAmount } from "@/common/utils/NumberFormatUtils";
import { Dec } from "@keplr-wallet/unit";
import EmptyState from "@/common/components/EmptyState.vue";

const i18n = useI18n();
const configStore = useConfigStore();
const mobile = isMobile();
const props = defineProps<{
  lease?: LeaseInfo | null;
}>();

const columns = computed<TableColumnProps[]>(() => [
  { label: i18n.t("message.history-transaction"), variant: "left" },
  { label: i18n.t("message.date-pascal-case"), class: "hidden md:flex max-w-[180px]" },
  { label: i18n.t("message.status"), class: "max-w-[110px]" }
]);

const leasesHistory = computed(() => {
  return (props.lease?.etl_data?.history ?? []).map((item) => {
    const ticker = item.symbol ?? "";
    const currency = configStore.currenciesData?.[`${ticker}@${props.lease!.protocol}`];
    const amountDec = new Dec(item.amount ?? "0", currency?.decimal_digits);
    const amountLabel = mobile ? formatMobileAmount(amountDec) : formatTokenBalance(amountDec);
    return {
      items: [
        {
          value: `${i18n.t(`message.${item.action}`)} ${amountLabel} ${currency?.shortName ?? ""}`,
          variant: "left",
          class: "text-typography-link font-semibold"
        },
        { value: getCreatedAtForHuman(new Date(item.timestamp ?? Date.now())), class: "hidden md:flex max-w-[180px]" },
        {
          component: () => h<LabelProps>(Label, { value: i18n.t("message.completed"), variant: "success" }),
          class: "max-w-[110px]"
        }
      ]
    };
  }) as TableRowItemProps[];
});
</script>
