<template>
  <Button
    ref="popoverParent"
    severity="tertiary"
    size="small"
    icon="history"
    class="text-icon-default"
    @click="isOpen = !isOpen"
  />
  <TransactionDetails ref="transactionDialogRef" />
  <Popover
    v-if="isOpen"
    position="bottom-right"
    :parent="popoverParent"
    :title="$t('message.activities')"
    @close="isOpen = !isOpen"
    class="md:max-w-[385px]"
  >
    <template #header> </template>
    <template #content>
      <template v-if="wallet.activities.data.length > 0">
        <div class="flex h-full flex-col">
          <div class="custom-scroll max-h-auto h-full overflow-y-auto md:max-h-[512px]">
            <ActivitiesItem
              v-for="transaction in wallet.activities.data"
              :key="transaction.tx_hash"
              :coinMinimalDenom="transaction.historyData?.coin?.currency?.coinMinimalDenom"
              :title="transaction.historyData.msg"
              :type="transaction.historyData.icon"
              :time="transaction.historyData.timestamp"
              :route="transaction.historyData.route"
              @click="onActivityClick(transaction as any)"
            />
          </div>
          <div class="flex justify-center rounded-b-xl border-t border-border-color bg-neutral-bg-1 p-3">
            <Button
              :label="$t('message.view-all-activites')"
              class="w-full"
              severity="secondary"
              size="medium"
              @click="
                () => {
                  router.push(`/${RouteNames.HISTORY}`);
                  isOpen = false;
                }
              "
            />
          </div>
        </div>
      </template>
      <template v-else>
        <EmptyState
          :slider="[
            {
              image: { name: 'no-notifications' },
              title: $t('message.no-notifications'),
              description: $t('message.come-back-later')
            }
          ]"
        />
      </template>
    </template>
  </Popover>
</template>

<script lang="ts" setup>
import EmptyState from "@/common/components/EmptyState.vue";
import ActivitiesItem from "./ActivitiesItem.vue";
import TransactionDetails from "./TransactionDetails.vue";
import { ref } from "vue";
import { Button, Popover } from "web-components";
import { useRouter } from "vue-router";
import { RouteNames } from "@/router";
import { useWalletStore } from "@/common/stores/wallet";
import { type ITransactionData } from "@/modules/history/types";
import type { HistoryData } from "@/modules/history/types/ITransaction";

const transactionDialogRef = ref<typeof TransactionDetails | null>(null);
const popoverParent = ref();
const isOpen = ref(false);

const router = useRouter();
const wallet = useWalletStore();

const onActivityClick = (transaction: ITransactionData & HistoryData) => {
  transactionDialogRef.value?.show(transaction);
  isOpen.value = false;
};
</script>
