<template>
  <Table
    v-if="items?.length > 0"
    :columns="columns"
    searchable
    :size="`${items.length} ${$t('message.assets')}`"
    class="min-w-[500px]"
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
  <!-- <EmptyState
    v-else
    :image="{ name: 'deposit-assets' }"
    title="Deposit assets"
    description="Deposit assets to start leasing"
    :link="{ label: 'Learn more about assets', url: '#' }"
  /> -->
</template>

<script lang="ts" setup>
import { Table, TableRow, type TableColumnProps, type TableRowItemProps } from "web-components";
import { useI18n } from "vue-i18n";

// import EmptyState from "@/common/components/EmptyState.vue";
const i18n = useI18n();

const columns: TableColumnProps[] = [
  { label: i18n.t("message.asset"), variant: "left" },
  { label: i18n.t("message.deposit"), tooltip: { position: "top", content: "Yield tooltip" } },
  { label: i18n.t("message.yield"), tooltip: { position: "top", content: "Yield tooltip" } },
  { label: i18n.t("message.availability"), tooltip: { position: "top", content: "Yield tooltip" } }
];

defineProps<{
  items: TableRowItemProps[];
}>();
</script>
