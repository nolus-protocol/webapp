<template>
  <TableRow :items="transactionData.items" />
  <TransactionDetails ref="transactionDialogRef" />
</template>

<script lang="ts" setup>
import { type ITransactionData } from "../types";
import type { HistoryData } from "../types/ITransaction";

import { useI18n } from "vue-i18n";
import { computed, h, ref } from "vue";
import { Label, type LabelProps, TableRow, type TableRowItemProps } from "web-components";
import TransactionDetails from "@/common/components/activities/TransactionDetails.vue";
import Action, { type IAction } from "@/modules/history/components/Action.vue";
import { CONFIRM_STEP } from "@/common/types";
import { getCreatedAtForHuman } from "@/common/utils";

const i18n = useI18n();
const transactionDialogRef = ref<typeof TransactionDetails | null>(null);

interface Props {
  transaction: ITransactionData & HistoryData;
}
const props = defineProps<Props>();

const transactionData = computed(
  () =>
    ({
      items: [
        {
          value: props.transaction.historyData.msg,
          variant: "left",
          click: onActivityClick,
          class: "text-typography-link cursor-pointer font-semibold"
        },
        {
          value: props.transaction.historyData.action,
          class: "max-w-[140px] capitalize"
        },
        {
          value: getTimeStamp(),
          class: "max-w-[180px]"
        },
        {
          component: () => h<LabelProps>(Label, getStatus()),
          class: "max-w-[150px]"
        },
        {
          component: () =>
            h<IAction>(Action, {
              transaction: props.transaction,
              onClick: onActivityClick
            }),
          class: "max-w-[120px]"
        }
      ]
    }) as TableRowItemProps
);

function getTimeStamp() {
  if (props.transaction.historyData.skipRoute) {
    return getCreatedAtForHuman(new Date(props.transaction.historyData.id!));
  }
  if (props.transaction.historyData.timestamp) {
    return props.transaction.historyData.timestamp;
  }
  return props.transaction.block;
}

function getStatus() {
  switch (props.transaction.historyData.status) {
    case CONFIRM_STEP.PENDING: {
      return { value: i18n.t(`message.loading`), variant: "warning" } as any;
    }
    case CONFIRM_STEP.ERROR: {
      return { value: i18n.t(`message.error`), variant: "error" } as any;
    }
  }
  return { value: i18n.t(`message.completed`), variant: "success" } as any;
}

const onActivityClick = () => {
  transactionDialogRef.value?.show(props.transaction);
};
</script>
