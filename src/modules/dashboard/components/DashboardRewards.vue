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
          fontSize: isMobile() ? 20 : 32,
          animatedReveal: true
        }"
      />

      <BigNumber
        v-if="!isEmpty"
        :label="$t('message.unclaimed-staking-widget')"
        :amount="{
          amount: stableRewards,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol,
          fontSize: isMobile() ? 20 : 32,
          animatedReveal: true
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
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { EtlApi, isMobile, Logger, walletOperation } from "@/common/utils";
import { getCurrencyByTicker } from "@/common/utils/CurrencyLookup";
import { Dec } from "@keplr-wallet/unit";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import { useStakingStore } from "@/common/stores/staking";
import { usePricesStore } from "@/common/stores/prices";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  showEmpty: boolean;
}>();

const wallet = useWalletStore();
const stakingStore = useStakingStore();
const pricesStore = usePricesStore();

const earningsAmount = ref("0.00");
const loadingStaking = ref(false);
const disabled = ref(false);

// Set staking address when wallet connects/disconnects
watch(
  () => wallet.wallet?.address,
  async (address) => {
    if (address) {
      await stakingStore.setAddress(address);
      await loadEarnings();
    } else {
      stakingStore.clear();
    }
  },
  { immediate: true }
);

const isEmpty = computed(() => {
  return props.showEmpty || !stakingStore.hasPositions;
});

// Calculate staking rewards in USD
const stableRewards = computed(() => {
  const nativeCurrency = getCurrencyByTicker(NATIVE_ASSET.ticker);
  const price = nativeCurrency ? pricesStore.getPriceAsNumber(nativeCurrency.key) : 0;
  const rewardsAmount = new Dec(stakingStore.totalRewards, NATIVE_ASSET.decimal_digits);
  const stable = rewardsAmount.mul(new Dec(price));
  return stable.toString(NATIVE_CURRENCY.maximumFractionDigits);
});

async function loadEarnings() {
  if (wallet.wallet?.address) {
    try {
      const res = await EtlApi.fetchEarnings(wallet.wallet.address);
      earningsAmount.value = res.earnings;
    } catch (e) {
      Logger.error(e);
    }
  }
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

async function requestClaim() {
  try {
    loadingStaking.value = true;
    if (wallet.wallet) {
      // Build claim data from staking store rewards
      const data = stakingStore.rewards
        .filter((reward) => {
          // Check if any reward has positive amount
          return reward.rewards.some((r) => {
            const amount = new Dec(r.amount, NATIVE_ASSET.decimal_digits);
            return amount.isPositive();
          });
        })
        .map((reward) => ({
          validator: reward.validator_address,
          delegator: wallet.wallet?.address
        }));

      if (data.length > 0) {
        const { txBytes } = await wallet.wallet.simulateWithdrawRewardTx(data);
        await wallet.wallet.broadcastTx(txBytes as Uint8Array);

        // Refresh staking data after claim
        await stakingStore.fetchPositions();
      }
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
