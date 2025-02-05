<template>
  <div class="flex flex-col gap-8">
    <ListHeader :title="$t('message.stake')">
      <div
        class="flex gap-2"
        v-if="wallet.wallet"
      >
        <Button
          :label="$t('message.delegate')"
          severity="secondary"
          size="large"
          @click="() => router.push(`/${RouteNames.STAKE}/${StakeDialog.DELEGATE}`)"
        />
        <Button
          :label="$t('message.undelegate')"
          severity="secondary"
          size="large"
          @click="() => router.push(`/${RouteNames.STAKE}/${StakeDialog.UNDELEGATE}`)"
        />
      </div>
    </ListHeader>
    <div class="flex flex-col gap-8 lg:flex-row">
      <DelegationOverview
        :delegated="delegated"
        :stableDelegated="stableDelegated"
        :validators="validators"
        :showEmpty="showEmpty"
        :unboundingDelegations="unboundingDelegations"
        class="order-2 lg:order-none lg:flex-[60%]"
      />
      <StakingRewards
        :reward="reward"
        :stableRewards="stableRewards"
        :showEmpty="showEmpty"
        class="order-1 lg:order-none lg:flex-[40%]"
      />
    </div>
    <router-view></router-view>
  </div>
</template>

<script lang="ts" setup>
import { Button, Label, type LabelProps, type TableRowItemProps } from "web-components";
import { RouteNames } from "@/router";

import ListHeader from "@/common/components/ListHeader.vue";

import { StakeDialog } from "@/modules/stake/enums";
import { DelegationOverview, StakingRewards } from "./components";
import { h, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { AssetUtils, Logger, NetworkUtils } from "@/common/utils";
import { useApplicationStore } from "@/common/stores/application";
import { NATIVE_ASSET, NATIVE_CURRENCY, PERCENT, UPDATE_REWARDS_INTERVAL } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { coin } from "@cosmjs/stargate";
import { Intercom } from "@/common/utils/Intercom";
import { useOracleStore } from "@/common/stores/oracle";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import type { IObjectKeys } from "@/common/types";

let interval: NodeJS.Timeout | undefined;
const application = useApplicationStore();
const wallet = useWalletStore();
const oracle = useOracleStore();
const i18n = useI18n();
const router = useRouter();

const delegated = ref(`0`);
const stableDelegated = ref("0.00");
const validators = ref<TableRowItemProps[]>([]);
const stableRewards = ref("0.00");
const showEmpty = ref(false);
const reward = ref<{
  amount: string;
  stableAmount: string;
  icon: string;
}>();
const unboundingDelegations = ref<IObjectKeys[]>([]);

onMounted(async () => {
  try {
    await Promise.all([loadDelegated(), loadDelegator(), loadUnboundingDelegations()]);

    interval = setInterval(async () => {
      await Promise.allSettled([loadDelegated(), loadDelegator(), loadUnboundingDelegations()]);
    }, UPDATE_REWARDS_INTERVAL);
  } catch (e: Error | any) {
    Logger.error(e);
  }
});

onUnmounted(() => {
  clearInterval(interval);
});

watch(
  () => wallet.wallet,
  async (value) => {
    await Promise.allSettled([loadDelegated(), loadDelegator(), loadUnboundingDelegations()]);
  }
);

watch(
  () => application.sessionExpired,
  (value) => {
    if (value) {
      clearInterval(interval);
    }
  }
);

async function loadUnboundingDelegations() {
  unboundingDelegations.value = await NetworkUtils.loadUnboundingDelegations();
}

async function loadDelegator() {
  const delegator = await NetworkUtils.loadDelegator();
  const total = new Dec(new Dec(delegator?.total?.[0]?.amount ?? 0).truncate(), NATIVE_ASSET.decimal_digits);

  const currency = AssetUtils.getCurrencyByTicker(NATIVE_ASSET.ticker);
  const price = new Dec(oracle.prices?.[currency.key]?.amount ?? 0);
  const stable = price.mul(total);

  reward.value = {
    amount: `${AssetUtils.formatNumber(total.toString(), NATIVE_ASSET.decimal_digits)} ${NATIVE_ASSET.label}`,
    stableAmount: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(stable.toString(2), 2)}`,
    icon: NATIVE_ASSET.icon
  };

  stableRewards.value = stable.toString(2);
}

async function loadDelegated() {
  const delegations = await NetworkUtils.loadDelegations();
  const promises = [];
  let decimalDelegated = new Dec(0);
  validators.value = [];

  const currency = AssetUtils.getCurrencyByTicker(NATIVE_ASSET.ticker);
  const price = new Dec(oracle.prices?.[currency.key]?.amount ?? 0);

  for (const item of delegations) {
    const d = new Dec(item.balance.amount);
    decimalDelegated = decimalDelegated.add(d);

    async function fn() {
      const validator = (await NetworkUtils.loadValidator(item.delegation.validator_address)).validator;
      const rate = new Dec(validator.commission.commission_rates.rate).mul(new Dec(PERCENT)).toString(0);
      const amount = new Dec(item.balance.amount, NATIVE_ASSET.decimal_digits);

      const stable = amount.mul(price);
      const amount_label = AssetUtils.formatNumber(amount.toString(), 3);
      const stable_label = AssetUtils.formatNumber(stable.toString(), 2);

      validators.value.push({
        items: [
          {
            value: validator.description.moniker,
            subValue: validator.description.website,
            variant: "left"
          },
          {
            value: `${amount_label} ${NATIVE_ASSET.label}`,
            subValue: `${NATIVE_CURRENCY.symbol}${stable_label}`,
            variant: "right",
            class: "hidden md:flex"
          },
          { value: `${rate}%`, class: "hidden md:flex max-w-[100px]" },
          {
            class: "max-w-[100px]",
            component: () =>
              validator.jailed
                ? h<LabelProps>(Label, { value: i18n.t("message.jailed"), variant: "error" })
                : h<LabelProps>(Label, { value: i18n.t("message.active"), variant: "secondary" })
          }
        ]
      });
    }

    promises.push(fn());
  }

  const d = { balance: coin(decimalDelegated.truncate().toString(), NATIVE_ASSET.denom) };
  const amount = new Dec(d.balance.amount);
  const stable = new Dec(d.balance.amount, NATIVE_ASSET.decimal_digits).mul(price);

  delegated.value = amount.toString();
  stableDelegated.value = stable.toString(2);

  if (promises.length == 0) {
    showEmpty.value = true;
  } else {
    showEmpty.value = false;
  }

  await Promise.all(promises);

  Intercom.update({
    Nlsamountdelegated: new Dec(d.balance.amount ?? 0, NATIVE_ASSET.decimal_digits).toString()
  });
}

provide("loadRewards", loadDelegator);
</script>
