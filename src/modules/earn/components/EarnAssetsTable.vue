<template>
  <Table
    :columns="columns"
    searchable
    :size="isMobile() ? '' : `${items.length} ${$t('message.assets')}`"
    tableWrapperClasses="pr-6 md:min-w-auto md:p-0"
    tableClasses="min-w-[600px]"
    @input="(e: Event) => onSearch((e.target as HTMLInputElement).value)"
    @onSearchClear="onSearch('')"
  >
    <slot></slot>
    <template v-slot:body>
      <TableRow
        v-for="(row, index) in items"
        :key="index"
        :items="row.items"
      />
    </template>
  </Table>
</template>

<script lang="ts" setup>
import { Table, type TableColumnProps, TableRow, type TableRowItemProps } from "web-components";
import { useI18n } from "vue-i18n";
import { isMobile } from "@/common/utils";

const i18n = useI18n();

const columns: TableColumnProps[] = [
  { label: i18n.t("message.asset"), variant: "left" },
  { label: i18n.t("message.deposit"), tooltip: { position: "top", content: i18n.t("message.deposit-tooltip") } },
  { label: i18n.t("message.yield"), tooltip: { position: "top", content: i18n.t("message.yield-tooltip") } },
  {
    label: i18n.t("message.availability"),
    tooltip: { position: "top", content: i18n.t("message.availability-tooltip") }
  }
];

defineProps<{
  items: TableRowItemProps[];
  onSearch: Function;
}>();
</script>
