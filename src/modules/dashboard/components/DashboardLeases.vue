<template>
  <Widget class="overflow-auto">
    <WidgetHeader
      :label="isVisible && !emptyState ? $t('message.dashboard-lease-title') : ''"
      :icon="isVisible && !emptyState ? { name: 'leases', class: 'fill-icon-link' } : undefined"
      :badge="isVisible && !emptyState ? { content: leases.length.toString() } : undefined"
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
              denom: NATIVE_CURRENCY.symbol
            }"
            :pnl-status="{
              positive: pnl_percent.isPositive() || pnl_percent.isZero(),
              value: `${pnl_percent.isPositive() || pnl_percent.isZero() ? '+' : '-'}${pnl_percent.abs().toString(2)}%`,
              badge: {
                content: pnl_percent.toString(),
                base: false
              }
            }"
            :loading="loaded"
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
              button: wallet.wallet
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
import { useLeases } from "@/common/composables";
import { computed, ref, watch } from "vue";
import { Coin, Dec } from "@keplr-wallet/unit";
import { Intercom } from "@/common/utils/Intercom";
import { useWalletStore } from "@/common/stores/wallet";
import { useOracleStore } from "@/common/stores/oracle";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils, Logger, WalletManager } from "@/common/utils";
import { useApplicationStore } from "@/common/stores/application";
import { NATIVE_CURRENCY } from "@/config/global";
import { useRouter } from "vue-router";

const { leases, getLeases } = useLeases((error: Error | any) => {});
const pnl = ref(new Dec(0));
const pnl_percent = ref(new Dec(0));
const count = ref(0);

const router = useRouter();
const wallet = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();
const loaded = ref(true);
const hide = ref(WalletManager.getHideBalances());

defineProps<{ isVisible: boolean }>();

watch(
  () => leases.value,
  () => {
    setLeases();
  }
);

watch(
  () => wallet.wallet,
  () => {
    getLeases();
  }
);

const emptyState = computed(() => {
  return !loaded.value && count.value == 0;
});

function setLeases() {
  try {
    let db = new Dec(0);
    let ls = new Dec(0);
    let pl = new Dec(0);
    let pnlPercent = new Dec(0);
    let c = 0;
    for (const lease of leases.value) {
      if (lease.leaseStatus?.opened) {
        const dasset = app.currenciesData![`${lease.leaseStatus.opened.amount.ticker}@${lease.protocol}`];
        const lpn = AssetUtils.getLpnByProtocol(lease.protocol);
        const price = oracle.prices[lpn.key];
        const downpayment = lease.leaseData?.downPayment ? lease.leaseData?.downPayment : new Dec(0);
        const dDecimal = Number(dasset!.decimal_digits);
        const l = CurrencyUtils.calculateBalance(
          oracle.prices[dasset.key]?.amount,
          new Coin(dasset.ibcData, lease.leaseStatus.opened.amount.amount),
          dDecimal
        ).toDec();

        ls = ls.add(l);
        lease.debt = lease.debt.mul(new Dec(price.amount));
        pnlPercent = pnlPercent.add(
          lease.pnlAmount
            .quo((downpayment as Dec).add((lease.leaseData?.repayment_value ?? new Dec(0)) as Dec))
            .mul(new Dec(100))
        );
        c++;
      }
      db = db.add(lease.debt as Dec);
      pl = pl.add(lease.pnlAmount as Dec);
    }
    pnl.value = pl;
    count.value = c;
    if (c) {
      pnl_percent.value = pnlPercent.quo(new Dec(c));
    }
    Intercom.update({
      PositionsUnrealizedPnlUSD: pl.toString(),
      PositionsDebtUSD: db.toString(),
      Positionsvalueusd: ls.toString()
    });
  } catch (e) {
    Logger.error(e);
  } finally {
    loaded.value = false;
  }
}
</script>
