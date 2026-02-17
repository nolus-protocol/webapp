<template>
  <Widget class="h-fit">
    <WidgetHeader
      :label="$t('message.staking-rewards')"
      :icon="{ name: 'list-sparkle' }"
    >
      <Button
        v-if="!showEmpty"
        :label="$t('message.claim-rewards')"
        severity="secondary"
        size="large"
        :loading="loading"
        :disabled="disabled"
        @click="onWithdrawRewards"
      />
    </WidgetHeader>
    <div
      class="flex flex-col gap-y-2"
      v-if="!showEmpty"
    >
      <BigNumber
        :label="$t('message.unclaimed-staking')"
        :amount="{
          value: stableRewards,
          denom: NATIVE_CURRENCY.symbol,
          fontSize: 24,
          compact: mobile
        }"
      />
    </div>

    <Asset
      v-if="!showEmpty"
      v-for="reward of rewards"
      :icon="reward.icon"
      :amount="reward.amount"
      :stable-amount="reward.stableAmount"
    />

    <EmptyState
      v-if="showEmpty"
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
import { Asset, Button, ToastType, Widget } from "web-components";
import { NATIVE_CURRENCY } from "@/config/global";
import { Logger, walletOperation } from "@/common/utils";
import { useWalletStore } from "@/common/stores/wallet";
import { useBalancesStore } from "@/common/stores/balances";
import { useHistoryStore } from "@/common/stores/history";
import { useStakingStore } from "@/common/stores/staking";
import { useAsyncOperation } from "@/common/composables";
import { Dec } from "@keplr-wallet/unit";
import { NATIVE_ASSET } from "@/config/global";
import { inject, ref } from "vue";
import { useI18n } from "vue-i18n";

import EmptyState from "@/common/components/EmptyState.vue";
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";

defineProps<{
  rewards?: {
    amount: string;
    stableAmount: string;
    icon: string;
  }[];
  stableRewards: string;
  showEmpty: boolean;
}>();

const i18n = useI18n();
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});
const wallet = useWalletStore();
const balancesStore = useBalancesStore();
const historyStore = useHistoryStore();
const stakingStore = useStakingStore();
const { loading, run } = useAsyncOperation();
const disabled = ref(false);

async function onWithdrawRewards() {
  disabled.value = true;
  try {
    await walletOperation(requestClaim);
  } catch (error: Error | any) {
    Logger.error(error);
  } finally {
    disabled.value = false;
  }
}

async function requestClaim() {
  await run(async () => {
    if (!wallet.wallet) return;

    const data = stakingStore.rewards
      .filter((reward) => {
        return reward.rewards.some((r) => {
          const amount = new Dec(r.amount, NATIVE_ASSET.decimal_digits);
          return amount.isPositive();
        });
      })
      .map((reward) => ({
        validator: reward.validator_address,
        delegator: wallet.wallet?.address
      }));

    if (data.length === 0) {
      onShowToast({
        type: ToastType.error,
        message: i18n.t("message.no-rewards")
      });
      return;
    }

    const { txBytes } = await wallet.wallet.simulateWithdrawRewardTx(data);
    await wallet.wallet.broadcastTx(txBytes as Uint8Array);

    await Promise.all([stakingStore.fetchPositions(), balancesStore.fetchBalances()]);
    historyStore.loadActivities();
    onShowToast({
      type: ToastType.success,
      message: i18n.t("message.rewards-claimed-successful")
    });
  });
}
</script>
