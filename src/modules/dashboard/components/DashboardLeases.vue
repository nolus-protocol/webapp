<template>
  <Widget class="overflow-auto">
    <WidgetHeader
      :label="$t('message.leases')"
      :icon="{ name: 'leases', class: 'fill-icon-link' }"
      :badge="{ content: leases.length.toString() }"
    >
      <Button
        v-if="isVisible"
        :label="$t('message.viewAllLeases')"
        severity="secondary"
        size="large"
        @click="() => router.push(`/${RouteNames.LEASES}`)"
      />
      <template v-else>
        <Button
          v-if="wallet.wallet"
          :label="$t('message.new-lease')"
          severity="secondary"
          size="large"
          @click="() => router.push(`/${RouteNames.LEASES}/open/long`)"
        />
      </template>
    </WidgetHeader>
    <div>
      <template v-if="props.isVisible">
        <div class="flex gap-8">
          <BigNumber
            :label="$t('message.unrealized-pnl')"
            :amount="{
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
          />
          <BigNumber
            :label="$t('message.leases')"
            :amount="{
              amount: activeLeases.toString(),
              type: CURRENCY_VIEW_TYPES.CURRENCY,
              denom: NATIVE_CURRENCY.symbol,
              fontSize: 20,
              fontSizeSmall: 20
            }"
            :loading="loaded"
          />
          <BigNumber
            :label="$t('message.debt')"
            :amount="{
              amount: debt.toString(),
              type: CURRENCY_VIEW_TYPES.CURRENCY,
              denom: NATIVE_CURRENCY.symbol,
              fontSize: 20,
              fontSizeSmall: 20
            }"
            :loading="loaded"
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
              description: $t('message.start-lease'),
              link: { label: 'Learn more about assets', url: '#' }
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

import { Button, Widget } from "web-components";
import { RouteNames } from "@/router";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { useLeases } from "@/common/composables";
import { ref, watch } from "vue";
import { Coin, Dec } from "@keplr-wallet/unit";
import { Intercom } from "@/common/utils/Intercom";
import { useWalletStore } from "@/common/stores/wallet";
import { useOracleStore } from "@/common/stores/oracle";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils, Logger } from "@/common/utils";
import { useApplicationStore } from "@/common/stores/application";
import UnrealizedPnlChart from "./UnrealizedPnlChart.vue";
import { NATIVE_CURRENCY } from "@/config/global";
import { useRouter } from "vue-router";
import EmptyState from "@/common/components/EmptyState.vue";

const { leases, getLeases } = useLeases((error: Error | any) => {});
const activeLeases = ref(new Dec(0));
const pnl = ref(new Dec(0));
const debt = ref(new Dec(0));
const pnl_percent = ref(new Dec(0));

const router = useRouter();
const wallet = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();
const loaded = ref(true);

const props = defineProps<{ isVisible: boolean }>();

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

function setLeases() {
  try {
    let db = new Dec(0);
    let ls = new Dec(0);
    let pl = new Dec(0);
    let pnlPercent = new Dec(0);
    let count = 0;
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
        pnlPercent = pnlPercent.add(lease.pnlAmount.quo(downpayment as Dec).mul(new Dec(100)));
        count++;
      }
      db = db.add(lease.debt as Dec);
      pl = pl.add(lease.pnlAmount as Dec);
    }
    activeLeases.value = ls;
    debt.value = db;
    pnl.value = pl;
    if (count) {
      pnl_percent.value = pnlPercent.quo(new Dec(count));
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
