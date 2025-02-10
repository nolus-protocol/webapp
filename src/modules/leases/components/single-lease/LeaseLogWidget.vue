<template>
  <Widget class="overflow-auto"
    ><WidgetHeader
      :label="$t('message.lease-log')"
      :icon="{ name: 'history', class: 'fill-icon-link' }"
    />
    <Table
      v-if="leasesHistory.length > 0"
      :columns="leasesHistory.length > 0 ? columns : []"
      :class="[{ 'min-w-[600px]': leasesHistory.length > 0 }]"
    >
      <template v-slot:body>
        <TableRow
          v-for="(row, index) in leasesHistory"
          :key="index"
          :items="row.items"
        />
      </template>
    </Table>
    <EmptyState
      v-else
      :slider="[
        {
          image: { name: 'no-entries' },
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
  SvgIcon,
  type SvgProps,
  Table,
  type TableColumnProps,
  TableRow,
  type TableRowItemProps,
  Widget
} from "web-components";
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import { computed, h } from "vue";
import type { LeaseData } from "@/common/types";
import { useApplicationStore } from "@/common/stores/application";
import { getCreatedAtForHuman } from "@/common/utils";
import { Dec } from "@keplr-wallet/unit";
import EmptyState from "@/common/components/EmptyState.vue";

const i18n = useI18n();
const app = useApplicationStore();
const props = defineProps<{
  lease?: LeaseData;
}>();

const columns: TableColumnProps[] = [
  { label: i18n.t("message.history-transaction"), variant: "left" },
  { label: i18n.t("message.date-pascal-case"), class: "max-w-[180px]" },
  { label: i18n.t("message.status"), class: "max-w-[110px]" },
  { label: i18n.t("message.action"), class: "max-w-[70px]" }
];

const leasesHistory = computed(() => {
  return (props.lease?.leaseData?.history ?? []).map((item) => {
    const currency = app.currenciesData?.[`${item.symbol}@${props.lease!.protocol}`];
    return {
      items: [
        {
          value: `${i18n.t(`message.${item.type}`)} ${new Dec(item.amount, currency?.decimal_digits).toString(currency?.decimal_digits)} ${currency?.shortName}`,
          variant: "left",
          class: "text-typography-link font-semibold"
        },
        { value: getCreatedAtForHuman(new Date(item.time)), class: "max-w-[180px]" },
        {
          component: () => h<LabelProps>(Label, { value: i18n.t("message.success"), variant: "success" }),
          class: "max-w-[110px]"
        },
        { component: () => h<SvgProps>(SvgIcon, { name: "more" }), class: "max-w-[70px] pr-4" }
      ]
    };
  }) as TableRowItemProps[];
});
</script>
