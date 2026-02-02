<template>
  <Widget class="overflow-auto">
    <WidgetHeader
      :label="isVisible && !emptyState ? $t('message.dashboard-lease-title') : ''"
      :icon="isVisible && !emptyState ? { name: 'leases', class: 'fill-icon-link' } : undefined"
      :badge="isVisible && !emptyState ? { content: leasesStore.openLeases.length.toString() } : undefined"
    >
      <template v-if="isVisible && !emptyState">
        <Button
          v-if="wallet.wallet"
          :label="$t('message.view-details')"
          severity="secondary"
          size="large"
          @click="() => router.push(`/${RouteNames.LEASES}`)"
        />
      </template>
    </WidgetHeader>
    <div>
      <template v-if="isVisible && !emptyState">
        <div class="mb-6 flex gap-8">
          <BigNumber
            :label="$t('message.unrealized-pnl')"
            :amount="{
              hide: hide,
              amount: pnl.toString(),
              type: CURRENCY_VIEW_TYPES.CURRENCY,
              denom: NATIVE_CURRENCY.symbol,
              animatedReveal: true,
              fontSize: isMobile() ? 20 : 32
            }"
            :pnl-status="{
              positive: pnlPercent.isPositive() || pnlPercent.isZero(),
              value: `${pnlPercent.isPositive() || pnlPercent.isZero() ? '+' : '-'}${pnlPercent.abs().toString(2)}%`,
              badge: {
                content: pnlPercent.toString(),
                base: false
              }
            }"
            :loading="leasesStore.loading"
            :loadingWidth="'80px'"
          />
        </div>
        <UnrealizedPnlChart />
      </template>
      <template v-else>
        <EmptyState
          :slider="[
            {
              image: { name: 'new-lease' },
              title: $t('message.start-lease'),
              description: $t('message.start-lease-description'),
              button:
                wallet.wallet && !isProtocolDisabled
                  ? { name: $t('message.open-position'), icon: 'plus', url: '/leases/open/long' }
                  : undefined,
              link: { label: $t('message.learn-new-leases'), url: `/learn-leases` }
            }
          ]"
        />
      </template>
    </div>
  </Widget>
</template>

<script lang="ts" setup>
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import UnrealizedPnlChart from "./UnrealizedPnlChart.vue";
import EmptyState from "@/common/components/EmptyState.vue";

import { Button, Widget } from "web-components";
import { RouteNames } from "@/router";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { computed, ref, watch } from "vue";
import { Dec } from "@keplr-wallet/unit";
import { IntercomService } from "@/common/utils/IntercomService";
import { useWalletStore } from "@/common/stores/wallet";
import { useLeasesStore } from "@/common/stores/leases";
import { usePricesStore } from "@/common/stores/prices";
import { isMobile, Logger, WalletManager } from "@/common/utils";
import { useApplicationStore } from "@/common/stores/application";
import { Contracts, NATIVE_CURRENCY } from "@/config/global";
import { useRouter } from "vue-router";

const router = useRouter();
const wallet = useWalletStore();
const leasesStore = useLeasesStore();
const pricesStore = usePricesStore();
const app = useApplicationStore();

const hide = ref(WalletManager.getHideBalances());

defineProps<{ isVisible: boolean }>();

// Set owner when wallet connects/disconnects
watch(
  () => wallet.wallet?.address,
  async (address) => {
    if (address) {
      await leasesStore.setOwner(address);
    } else {
      leasesStore.clear();
    }
  },
  { immediate: true }
);

const isProtocolDisabled = computed(() => {
  const protocols = Contracts.protocolsFilter[app.protocolFilter];
  return protocols.disabled;
});

const emptyState = computed(() => {
  return !leasesStore.loading && leasesStore.openLeases.length === 0;
});

// Calculate PnL from open leases
const pnl = computed(() => {
  let total = new Dec(0);
  for (const lease of leasesStore.openLeases) {
    if (lease.pnl?.amount) {
      total = total.add(new Dec(lease.pnl.amount));
    }
  }
  return total;
});

// Calculate PnL percentage
const pnlPercent = computed(() => {
  let totalPnl = new Dec(0);
  let totalDownpayment = new Dec(0);

  for (const lease of leasesStore.openLeases) {
    if (lease.pnl) {
      totalPnl = totalPnl.add(new Dec(lease.pnl.amount));
      totalDownpayment = totalDownpayment.add(new Dec(lease.pnl.downpayment || "0"));
    }
  }

  if (totalDownpayment.isZero()) {
    return new Dec(0);
  }

  return totalPnl.quo(totalDownpayment).mul(new Dec(100));
});

// Update Intercom with lease stats
watch(
  () => [leasesStore.openLeases, pricesStore.prices],
  () => {
    try {
      const leasesData = leasesStore.getLeasesWithDisplayData();
      const openLeasesData = leasesData.filter(
        (d) => d.lease.status === "opened" || d.lease.status === "opening"
      );

      let totalDebtUsd = new Dec(0);
      let totalValueUsd = new Dec(0);
      let totalPnl = new Dec(0);

      for (const data of openLeasesData) {
        totalDebtUsd = totalDebtUsd.add(data.totalDebtUsd);
        totalValueUsd = totalValueUsd.add(data.assetValueUsd);
        totalPnl = totalPnl.add(data.pnlAmount);
      }

      IntercomService.updatePositions({
        count: openLeasesData.length,
        valueUsd: totalValueUsd.toString(),
        debtUsd: totalDebtUsd.toString(),
        unrealizedPnlUsd: totalPnl.toString()
      });
    } catch (e) {
      Logger.error(e);
    }
  },
  { deep: true }
);
</script>
