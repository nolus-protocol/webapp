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
          amount: stableRewards,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol
        }"
      />
    </div>

    <Asset
      v-if="reward && !showEmpty"
      :icon="reward.icon"
      :amount="reward.amount"
      :stable-amount="reward.stableAmount"
    />

    <EmptyState
      v-if="showEmpty"
      :image="{ name: 'no-rewards' }"
      :title="$t('message.no-rewards')"
      :description="$t('message.deposit-assets')"
    />
  </Widget>
</template>

<script lang="ts" setup>
import { Button, Widget, Asset, ToastType } from "web-components";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { NATIVE_CURRENCY } from "@/config/global";
import { AssetUtils, Logger, NetworkUtils, walletOperation } from "@/common/utils";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec } from "@keplr-wallet/unit";
import { inject, ref } from "vue";
import { useI18n } from "vue-i18n";

import EmptyState from "@/common/components/EmptyState.vue";
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import BigNumber from "@/common/components/BigNumber.vue";

defineProps<{
  reward?: {
    amount: string;
    stableAmount: string;
    icon: string;
  };
  stableRewards: string;
  showEmpty: boolean;
}>();

const i18n = useI18n();
const onShowToast = inject("onShowToast", (data: { type: ToastType; message: string }) => {});
const loadRewards = inject("loadRewards", async () => {});
const wallet = useWalletStore();
const loading = ref(false);
const disabled = ref(false);

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
    loading.value = true;
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

      loadRewards();
    }
    await wallet.UPDATE_BALANCES();
    onShowToast({
      type: ToastType.success,
      message: i18n.t("message.rewards-claimed-successful")
    });
  } catch (error: Error | any) {
    Logger.error(error);
  } finally {
    loading.value = false;
  }
}
</script>
