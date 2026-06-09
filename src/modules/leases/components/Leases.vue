<template>
  <ListHeader :title="$t('message.positions')">
    <Button
      v-if="wallet.wallet && !isProtocolDisabled"
      :label="$t('message.new-lease')"
      severity="primary"
      size="large"
      @click="router.push({ path: `/${RouteNames.LEASES}/open/long` })"
    />
  </ListHeader>
  <Widget
    class="overflow-auto"
    v-if="leaseLoaded"
  >
    <EmptyState
      v-if="networkFilteredLeases.length == 0"
      :slider="[
        {
          image: { name: 'new-lease' },
          title: $t('message.start-lease'),
          description: $t('message.start-lease-description'),
          link: {
            label: $t('message.learn-new-leases'),
            onClick: () => IntercomService.askQuestion('How does margin leverage work?')
          }
        }
      ]"
    />
    <template v-else>
      <Table
        searchable
        :size="isTablet() ? '' : `${leasesData.length} ${$t('message.leases-table-label')}`"
        :columns="leasesData.length > 0 ? columns : []"
        tableWrapperClasses="md:min-w-auto md:p-0"
        tableClasses="md:min-w-[1000px]"
        :scrollable="!mobile"
        :hide-values="{ text: $t('message.toggle-values'), value: hide }"
        @hide-value="onHide"
        @onSearchClear="onSearch('')"
        @on-input="(e: Event) => onSearch((e.target as HTMLInputElement).value)"
      >
        <div class="flex flex-row flex-wrap gap-4 md:gap-8">
          <BigNumber
            :label="$t('message.unrealized-pnl')"
            :amount="{
              value: pnl.toString(2),
              denom: NATIVE_CURRENCY.symbol,
              fontSize: 24,
              animatedReveal: true,
              compact: mobile,
              class:
                pnl_percent.isPositive() || pnl_percent.isZero() ? 'text-typography-success' : 'text-typography-error'
            }"
          />
          <BigNumber
            :label="$t('message.leases-table')"
            :amount="{
              value: activeLeases.toString(2),
              denom: NATIVE_CURRENCY.symbol,
              fontSize: 24,
              animatedReveal: true,
              compact: mobile,
              hide: hide
            }"
          />
          <BigNumber
            class="hidden md:block"
            :label="$t('message.debt')"
            :amount="{
              value: debt.toString(2),
              denom: NATIVE_CURRENCY.symbol,
              fontSize: 24,
              animatedReveal: true,
              hide: hide
            }"
          />
        </div>
        <template v-slot:body>
          <TableRow
            v-for="(row, index) in leasesData"
            :key="index"
            :items="row.items"
            :scrollable="!mobile"
          />
        </template>
      </Table>
    </template>
  </Widget>
  <SharePnLDialog ref="sharePnlDialog" />
  <router-view />
</template>

<script lang="ts" setup>
import { Button, Table, TableRow, Widget } from "web-components";

import { RouteNames } from "@/router";

import BigNumber from "@/common/components/BigNumber.vue";
import ListHeader from "@/common/components/ListHeader.vue";
import EmptyState from "@/common/components/EmptyState.vue";
import SharePnLDialog from "@/modules/leases/components/single-lease/SharePnLDialog.vue";

import { isTablet, IntercomService } from "@/common/utils";
import { NATIVE_CURRENCY } from "@/config/global";
import { useLeases } from "./useLeases";

const {
  wallet,
  isProtocolDisabled,
  router,
  leaseLoaded,
  networkFilteredLeases,
  leasesData,
  columns,
  mobile,
  pnl,
  pnl_percent,
  activeLeases,
  debt,
  hide,
  onHide,
  onSearch,
  sharePnlDialog
} = useLeases();
</script>
