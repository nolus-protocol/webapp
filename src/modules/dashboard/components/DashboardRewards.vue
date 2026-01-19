<template>
  <Widget>
    <WidgetHeader
      :label="$t('message.staking-rewards-widget')"
      :icon="{ name: 'list-sparkle' }"
    >
    </WidgetHeader>
    <div class="flex flex-col gap-y-6">
      <BigNumber
        v-if="!isEmpty"
        :label="$t('message.earn-yield')"
        :amount="{
          amount: earningsAmount,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol,
          fontSize: isMobile() ? 20 : 32
        }"
      />

      <BigNumber
        v-if="!isEmpty"
        :label="$t('message.unclaimed-staking-widget')"
        :amount="{
          amount: stableRewards,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol,
          fontSize: isMobile() ? 20 : 32
        }"
      />

      <Button
        v-if="!isEmpty"
        class="self-start"
        :label="$t('message.claim-rewards-dashboard')"
        severity="secondary"
        size="large"
        :loading="loadingStaking"
        :disabled="disabled"
        @click="onWithdrawRewards"
      />
    </div>
    <!-- <Asset
      v-if="!isEmpty"
      v-for="reward of rewards"
      :icon="reward.icon"
      :amount="reward.amount"
      :stable-amount="`${reward.stableAmount}`"
    /> -->

    <EmptyState
      v-if="isEmpty"
      :slider="[
        {
          image: { name: 'no-rewards' },
          title: $t('message.no-rewards'),
          description: $t('message.no-rewards-description')
        }
      ]"
    />
  </Widget>
</template>

<script lang="ts" setup>
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import EmptyState from "@/common/components/EmptyState.vue";

import { Button, Widget } from "web-components";
import { CURRENCY_VIEW_TYPES, type IObjectKeys } from "@/common/types";
import { AssetUtils, EtlApi, isMobile, Logger, NetworkUtils, walletOperation } from "@/common/utils";
import { Dec } from "@keplr-wallet/unit";
import { NATIVE_CURRENCY } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { computed, ref, watch } from "vue";
import { useOracleStore } from "@/common/stores/oracle";

const props = defineProps<{
  showEmpty: boolean;
}>();

const wallet = useWalletStore();
const oracle = useOracleStore();
const emptyState = ref(false);
const earningsAmount = ref("0.00");

const loadingStaking = ref(false);
const disabled = ref(false);
const rewards = ref<
  {
    amount: string;
    stableAmount: string;
    icon: string;
  }[]
>();
const stableRewards = ref("0.00");

const isEmpty = computed(() => {
  return props.showEmpty || emptyState.value;
});

watch(
  () => [wallet.wallet, oracle.prices],
  async () => {
    try {
      await Promise.all([setRewards(), loadEarnings()]);
    } catch (e) {
      Logger.error(e);
    }
  },
  {
    immediate: true
  }
);

async function setRewards() {
  if (!wallet.wallet) {
    return false;
  }
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

  if (delegator.rewards.length == 0) {
    emptyState.value = true;
  } else {
    emptyState.value = false;
  }

  rewards.value = data;
  stableRewards.value = stable.toString(NATIVE_CURRENCY.maximumFractionDigits);
}

async function onWithdrawRewards() {
  try {
    disabled.value = true;
    await walletOperation(requestClaim);
  } catch (error: Error | any) {
    Logger.error(error);
  } finally {
    disabled.value = false;
  }
}

async function loadEarnings() {
  if (wallet.wallet?.address) {
    const res = await EtlApi.featchEarnings(wallet.wallet?.address);
    earningsAmount.value = res.earnings;
  }
}

async function requestClaim() {
  try {
    loadingStaking.value = true;
    if (wallet.wallet) {
      const delegator = await NetworkUtils.loadDelegator();

      const data = delegator.rewards
        .filter((item: any) => {
          const coin = item?.reward?.[0];

          if (coin) {
            const asset = AssetUtils.getCurrencyByDenom(coin.denom);
            const amount = new Dec(coin.amount, asset.decimal_digits);

            if (amount.isPositive()) {
              return true;
            }
          }

          return false;
        })
        .map((item: any) => {
          return {
            validator: item.validator_address,
            delegator: wallet.wallet?.address
          };
        });

      const { txHash, txBytes, usedFee } = await wallet.wallet.simulateWithdrawRewardTx(data);
      await wallet.wallet?.broadcastTx(txBytes as Uint8Array);

      setRewards();
    }

    wallet.loadActivities();
    await wallet.UPDATE_BALANCES();
  } catch (error: Error | any) {
    Logger.error(error);
  } finally {
    loadingStaking.value = false;
  }
}
</script>
