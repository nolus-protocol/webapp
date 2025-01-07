<template>
  <Widget>
    <WidgetHeader :label="$t('message.utilization-level')" />
    <Table :columns="columns">
      <template v-slot:body>
        <TableRow
          v-for="(row, index) in assets"
          :key="index"
          :items="row.items"
        />
      </template>
    </Table>
  </Widget>
</template>

<script lang="ts" setup>
import { Table, type TableColumnProps, TableRow, type TableRowItemProps, Widget } from "web-components";
import WidgetHeader from "@/common/components/WidgetHeader.vue";

const columns: TableColumnProps[] = [
  { label: "Asset", variant: "left" },
  { label: "Current utilization", class: "hidden md:flex" },
  { label: "Deposit cap", tooltip: { position: "top", content: "Yield tooltip" } },
  { label: "Yield", tooltip: { position: "top", content: "Yield tooltip" }, class: "hidden md:flex" }
];
const assets: TableRowItemProps[] = [
  {
    items: [
      {
        value: "Cosmos",
        subValue: "ATOM",
        image:
          "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/currencies/icons/neutron-usdc.svg",
        variant: "left"
      },
      { value: "43.23%", class: "hidden md:flex" },
      { value: "65%" },
      { value: "5.96%" }
    ]
  }
];
</script>

<style lang="" scoped></style>
