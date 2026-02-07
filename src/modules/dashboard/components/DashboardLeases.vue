<template>
  <Widget class="overflow-auto">
    <WidgetHeader
      :label="walletConnected && !emptyState ? $t('message.dashboard-lease-title') : ''"
      :icon="walletConnected && !emptyState ? { name: 'leases', class: 'fill-icon-link' } : undefined"
      :badge="walletConnected && !emptyState ? { content: networkFilteredLeases.length.toString() } : undefined"
    >
      <template v-if="walletConnected && !emptyState">
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
      <template v-if="walletConnected && !emptyState">
        <div class="mb-6 flex gap-8">
          <BigNumber
            :label="$t('message.unrealized-pnl')"
            :amount="{
              hide: hide,
              amount: pnl.toString(2),
              type: CURRENCY_VIEW_TYPES.CURRENCY,
              denom: NATIVE_CURRENCY.symbol,
              animatedReveal: true,
              fontSize: isMobile() ? 24 : 32
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
                  ? { name: $t('message.open-position'), icon: 'plus', url: `/${RouteNames.LEASES}/open/long` }
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
import { useWalletConnected } from "@/common/composables";
import { useConfigStore } from "@/common/stores/config";
import { NATIVE_CURRENCY } from "@/config/global";
import { useRouter } from "vue-router";

const router = useRouter();
const wallet = useWalletStore();
const leasesStore = useLeasesStore();
const pricesStore = usePricesStore();
const configStore = useConfigStore();
const walletConnected = useWalletConnected();

const hide = ref(WalletManager.getHideBalances());

// Wallet changes are handled by connectionStore.connectWallet() in entry-client.ts

const networkFilteredLeases = computed(() => {
  const activeProtocols = configStore.getActiveProtocolsForNetwork(configStore.protocolFilter);
  return leasesStore.openLeases.filter((lease) => {
    if (activeProtocols.includes(lease.protocol)) return true;
    const protocol = configStore.protocols[lease.protocol];
    return protocol?.network?.toUpperCase() === configStore.protocolFilter;
  });
});

const isProtocolDisabled = computed(() => {
  return configStore.isProtocolFilterDisabled(configStore.protocolFilter);
});

const emptyState = computed(() => {
  return !leasesStore.loading && networkFilteredLeases.value.length === 0;
});

// Calculate PnL from network-filtered open leases using LeaseCalculator
const pnl = computed(() => {
  let total = new Dec(0);
  for (const lease of networkFilteredLeases.value) {
    if (lease.status === "opened") {
      const displayData = leasesStore.getLeaseDisplayData(lease);
      total = total.add(displayData.pnlAmount);
    }
  }
  return total;
});

// Calculate PnL percentage
const pnlPercent = computed(() => {
  let totalPnl = new Dec(0);
  let totalDownpayment = new Dec(0);

  for (const lease of networkFilteredLeases.value) {
    if (lease.status === "opened") {
      const displayData = leasesStore.getLeaseDisplayData(lease);
      totalPnl = totalPnl.add(displayData.pnlAmount);
      totalDownpayment = totalDownpayment.add(displayData.downPayment).add(displayData.repaymentValue);
    }
  }

  if (totalDownpayment.isZero()) {
    return new Dec(0);
  }

  return totalPnl.quo(totalDownpayment).mul(new Dec(100));
});

// Update Intercom with network-filtered lease stats
watch(
  [networkFilteredLeases, () => pricesStore.prices],
  () => {
    try {
      let totalDebtUsd = new Dec(0);
      let totalValueUsd = new Dec(0);
      let totalPnl = new Dec(0);

      for (const lease of networkFilteredLeases.value) {
        const displayData = leasesStore.getLeaseDisplayData(lease);
        totalDebtUsd = totalDebtUsd.add(displayData.totalDebtUsd);
        totalValueUsd = totalValueUsd.add(displayData.assetValueUsd);
        totalPnl = totalPnl.add(displayData.pnlAmount);
      }

      IntercomService.updatePositions({
        count: networkFilteredLeases.value.length,
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
