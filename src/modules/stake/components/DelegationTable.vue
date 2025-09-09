<template>
  <Table
    v-if="validators?.length > 0"
    :columns="columns"
    tableClasses="min-w-[470px]"
  >
    <template v-slot:body>
      <TableRow
        v-for="(row, index) in validators"
        :key="index"
        :items="row.items"
      />
    </template>
    <template v-slot:footer>
      <Button
        class="mt-4 w-full md:float-end md:w-auto"
        :label="$t('message.manage-validators')"
        severity="secondary"
        icon="arrow-external"
        iconPosition="left"
        size="small"
        @click="openLink"
      />
    </template>
  </Table>
  <EmptyState
    v-if="showEmpty"
    :slider="[
      {
        image: { name: 'delegate-nls' },
        title: $t('message.delegate-nls'),
        description: $t('message.delegate-nls-description')
      },
      {
        image: { name: 'network-rewards' },
        title: $t('message.delegate-nls-2'),
        description: $t('message.delegate-nls-description-2')
      },
      {
        image: { name: 'government' },
        title: $t('message.delegate-nls-3'),
        description: $t('message.delegate-nls-description-3')
      },
      {
        image: { name: 'unlock-discounts' },
        title: $t('message.delegate-nls-4'),
        description: $t('message.delegate-nls-description-4')
      }
    ]"
  />
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { Button, Table, type TableColumnProps, TableRow, type TableRowItemProps } from "web-components";
import EmptyState from "@/common/components/EmptyState.vue";
import { NETWORK } from "@/config/global";

const i18n = useI18n();

const columns: TableColumnProps[] = [
  { label: i18n.t("message.validator"), variant: "left", class: "break-all" },
  { label: i18n.t("message.amount-delegated"), class: "md:flex" },
  { label: i18n.t("message.comm"), class: "md:flex max-w-[100px]" },
  { label: i18n.t("message.status"), class: "max-w-[140px]" }
];

function openLink() {
  window.open(NETWORK.staking, "_blank");
}

defineProps<{
  validators: TableRowItemProps[];
  showEmpty: boolean;
}>();
</script>
