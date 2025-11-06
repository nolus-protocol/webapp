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
      <div class="order-2 lg:order-none lg:flex-[60%]">
        <DelegationOverview
          :delegated="delegated"
          :stableDelegated="stableDelegated"
          :validators="validators"
          :showEmpty="showEmpty"
          :unboundingDelegations="unboundingDelegations"
        />

        <VestedOverview
          v-if="vestedTokens.length > 0"
          :vestedTokens="vestedTokens"
          class="mt-8"
        />
      </div>
      <StakingRewards
        :rewards="rewards"
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
import type { IObjectKeys } from "@/common/types";

import ListHeader from "@/common/components/ListHeader.vue";
import VestedOverview from "./components/VestedOverview.vue";

import { StakeDialog } from "@/modules/stake/enums";
import { DelegationOverview, StakingRewards } from "./components";
import { h, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { AssetUtils, Logger, NetworkUtils } from "@/common/utils";
import { NATIVE_ASSET, NATIVE_CURRENCY, PERCENT, UPDATE_REWARDS_INTERVAL } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { coin } from "@cosmjs/stargate";
import { Intercom } from "@/common/utils/Intercom";
import { useOracleStore } from "@/common/stores/oracle";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import RedelegateButton from "./components/RedelegateButton.vue";

let interval: NodeJS.Timeout | undefined;
const wallet = useWalletStore();
const oracle = useOracleStore();
const i18n = useI18n();
const router = useRouter();

const delegated = ref(`0`);
const stableDelegated = ref("0.00");
const validators = ref<TableRowItemProps[]>([]);
const stableRewards = ref("0.00");
const showEmpty = ref(false);
const rewards = ref<
  {
    amount: string;
    stableAmount: string;
    icon: string;
  }[]
>();
const unboundingDelegations = ref<IObjectKeys[]>([]);
const vestedTokens = ref([] as { endTime: string; amount: { amount: string; denom: string } }[]);

provide("onReload", async () => {
  await Promise.allSettled([loadDelegated(), loadDelegator(), loadUnboundingDelegations(), loadVested()]);
});

onMounted(async () => {
  try {
    await Promise.all([loadDelegated(), loadDelegator(), loadUnboundingDelegations(), loadVested()]);

    interval = setInterval(async () => {
      await Promise.allSettled([loadDelegated(), loadDelegator(), loadUnboundingDelegations(), loadVested()]);
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
    await Promise.allSettled([loadDelegated(), loadDelegator(), loadUnboundingDelegations(), loadVested()]);
  }
);

async function loadUnboundingDelegations() {
  unboundingDelegations.value = await NetworkUtils.loadUnboundingDelegations();
}

async function loadVested() {
  vestedTokens.value = await wallet.LOAD_VESTED_TOKENS();
}

async function loadDelegator() {
  const delegator = await NetworkUtils.loadDelegator();
  const data: {
    amount: string;
    stableAmount: string;
    icon: string;
  }[] = [];
  let stable = new Dec(0);
  (delegator?.total ?? [])?.forEach((item: IObjectKeys) => {
    const currency = AssetUtils.getCurrencyByDenom(item.denom);
    const total = new Dec(new Dec(item?.amount ?? 0).truncate(), currency.decimal_digits);
    const price = new Dec(oracle.prices?.[currency.key]?.amount ?? 0);
    const s = price.mul(total);

    data.push({
      amount: `${AssetUtils.formatNumber(total.toString(), currency.decimal_digits)} ${currency.shortName}`,
      stableAmount: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(s.toString(2), 2)}`,
      icon: currency.icon
    });

    stable = stable.add(s);
  });

  rewards.value = data;
  stableRewards.value = stable.toString(NATIVE_CURRENCY.maximumFractionDigits);
}

async function loadDelegated() {
  const delegations = (await NetworkUtils.loadDelegations())
    .sort((a, b) => {
      const ab = new Dec(a.balance.amount);
      const bb = new Dec(b.balance.amount);
      return Number(bb.sub(ab).toString(8));
    })
    .filter((item) => {
      if (new Dec(item.balance.amount).isZero()) {
        return false;
      }
      return true;
    });
  const promises = [];
  let decimalDelegated = new Dec(0);

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

      return {
        items: [
          {
            value: validator.description.moniker,
            subValue: validator.description.website,
            variant: "left",
            class: "break-all"
          },
          {
            value: `${amount_label} ${NATIVE_ASSET.label}`,
            subValue: `${NATIVE_CURRENCY.symbol}${stable_label}`,
            variant: "right",
            class: "md:flex"
          },
          { value: `${rate}%`, class: "md:flex max-w-[100px]" },
          {
            class: "max-w-[140px]",
            component: () =>
              validator.jailed
                ? h(RedelegateButton, { src: item.delegation.validator_address, amount: item.balance.amount })
                : h<LabelProps>(Label, { value: i18n.t("message.active"), variant: "secondary" })
          }
        ]
      };
    }

    promises.push(fn());
  }

  const d = { balance: coin(decimalDelegated.truncate().toString(), NATIVE_ASSET.denom) };
  const amount = new Dec(d.balance.amount);
  const stable = new Dec(d.balance.amount, NATIVE_ASSET.decimal_digits).mul(price);

  delegated.value = amount.truncate().toString();
  stableDelegated.value = stable.toString(2);

  if (promises.length == 0) {
    showEmpty.value = true;
  } else {
    showEmpty.value = false;
  }

  const data = (await Promise.all(promises)) as TableRowItemProps[];
  validators.value = data;

  Intercom.update({
    Nlsamountdelegated: new Dec(d.balance.amount ?? 0, NATIVE_ASSET.decimal_digits).toString()
  });
}

provide("loadRewards", loadDelegator);
</script>
