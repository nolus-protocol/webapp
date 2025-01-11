<template>
  <Table
    v-if="validators?.length > 0"
    :columns="columns"
  >
    <template v-slot:body>
      <div class="thin-scroll max-h-[600px] overflow-auto pr-2">
        <TableRow
          v-for="(row, index) in validators"
          :key="index"
          :items="row.items"
        />
      </div>
    </template>
    <template v-slot:footer>
      <Button
        class="md:float-end"
        :label="$t('message.manage-validators')"
        severity="secondary"
        icon="arrow-external"
        iconPosition="left"
        size="small"
        @click="() => {}"
      />
    </template>
  </Table>
  <EmptyState
    v-if="showEmpty"
    :image="{ name: 'delegate-nls' }"
    :title="$t('message.delegate-nls')"
    :description="$t('message.delegate-nls-description')"
  />
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { Button, Table, type TableColumnProps, TableRow, type TableRowItemProps } from "web-components";
import EmptyState from "@/common/components/EmptyState.vue";

const i18n = useI18n();

const columns: TableColumnProps[] = [
  { label: i18n.t("message.validator"), variant: "left" },
  { label: i18n.t("message.amount-delegated"), class: "hidden md:flex" },
  { label: i18n.t("message.comm"), class: "hidden md:flex max-w-[100px]" },
  { label: i18n.t("message.status"), class: "max-w-[100px]" }
];

defineProps<{
  validators: TableRowItemProps[];
  showEmpty: boolean;
}>();
</script>
